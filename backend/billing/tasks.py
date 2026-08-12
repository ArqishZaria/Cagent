"""
Celery-beat task: runs every 30 days (see CELERY_BEAT_SCHEDULE in settings.py).

For every tenant that isn't CANCELLED:
  1. If they have a still-unpaid invoice past its due date, flip them to
     PAID_OVERDUE — this is what core.middleware.IsSubscriptionActive checks
     to lock the tenant out of everything except /api/support/.
  2. Compute this cycle's invoice amount: the flat MONTHLY_SUBSCRIPTION_AMOUNT
     plus each currently-active PhoneNumber's monthly_cost — so a tenant
     holding more Telnyx numbers this month pays more this month, and the
     Invoice history itself becomes the per-month record of what they had.
  3. Generate the Invoice, email the breakdown, and drop an automated
     SupportMessage into their chat widget as a second, always-visible
     reminder (in case the email gets missed/filtered).
"""

import logging
import uuid
from datetime import timedelta
from decimal import Decimal

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from core.models import CustomUser, Invoice, PhoneNumber, SupportMessage, Tenant

logger = logging.getLogger(__name__)

INVOICE_DUE_IN_DAYS = 7


def _flag_overdue_tenants(tenant):
    """Marks the tenant PAID_OVERDUE if a prior invoice is unpaid past due_date."""
    has_unpaid_past_due = Invoice.objects.filter(
        tenant=tenant, is_paid=False, due_date__lt=timezone.now().date()
    ).exists()
    if has_unpaid_past_due and tenant.subscription_status != Tenant.SubscriptionStatus.PAID_OVERDUE:
        tenant.subscription_status = Tenant.SubscriptionStatus.PAID_OVERDUE
        tenant.save(update_fields=["subscription_status"])


def _calculate_invoice_amount(tenant):
    """
    Returns (total_amount, breakdown_lines) for this billing cycle:
    base subscription + sum of active PhoneNumber.monthly_cost for the
    tenant. breakdown_lines is a list of human-readable strings used in the
    invoice email / SupportMessage so the tenant can see exactly what
    they're being charged for each number.
    """
    base = Decimal(str(settings.MONTHLY_SUBSCRIPTION_AMOUNT))
    active_numbers = list(PhoneNumber.objects.filter(tenant=tenant, is_active=True))
    numbers_total = sum((n.monthly_cost for n in active_numbers), Decimal("0.00"))

    breakdown = [f"Base subscription: {base}"]
    if active_numbers:
        breakdown.append(f"Phone numbers ({len(active_numbers)} active):")
        for n in active_numbers:
            breakdown.append(f"  {n.phone_number} — {n.monthly_cost}/mo")
    total = base + numbers_total
    breakdown.append(f"Total due: {total}")
    return total, breakdown


def _bank_transfer_instructions(invoice, breakdown_lines):
    breakdown_text = "\n".join(breakdown_lines)
    return (
        f"{breakdown_text}\n\n"
        f"Due date: {invoice.due_date}\n"
        f"Invoice #: {invoice.invoice_number}\n\n"
        f"Please transfer via bank deposit / IBFT to:\n"
        f"Bank: {settings.BANK_NAME}\n"
        f"Account Title: {settings.BANK_ACCOUNT_TITLE}\n"
        f"Account Number: {settings.BANK_ACCOUNT_NUMBER}\n"
        f"IBAN: {settings.BANK_IBAN}\n\n"
        f"After transferring, please upload your receipt in the Support Chat "
        f"so we can mark your invoice as paid."
    )


def _send_invoice_email(tenant, invoice, breakdown_lines):
    admin_emails = list(
        CustomUser.objects.filter(tenant=tenant, role=CustomUser.Role.ADMIN)
        .exclude(email="")
        .values_list("email", flat=True)
    )
    if not admin_emails:
        logger.warning("Tenant %s has no admin email on file; skipping invoice email.", tenant.pk)
        return

    send_mail(
        subject=f"Invoice {invoice.invoice_number} — payment due {invoice.due_date}",
        message=_bank_transfer_instructions(invoice, breakdown_lines),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=admin_emails,
        fail_silently=True,  # a bad SMTP config should never break the billing cycle
    )


def _create_invoice_support_message(tenant, invoice, breakdown_lines):
    SupportMessage.objects.create(
        tenant=tenant,
        sender=None,
        is_from_platform_owner=True,
        message=(
            f"📄 New invoice {invoice.invoice_number} for {invoice.amount} is due "
            f"{invoice.due_date}.\n\n{_bank_transfer_instructions(invoice, breakdown_lines)}"
        ),
    )


@shared_task(bind=True)
def generate_monthly_invoices(self):
    tenants = Tenant.objects.exclude(subscription_status=Tenant.SubscriptionStatus.CANCELLED)

    processed = 0
    for tenant in tenants:
        try:
            _flag_overdue_tenants(tenant)

            amount, breakdown = _calculate_invoice_amount(tenant)

            invoice = Invoice.objects.create(
                tenant=tenant,
                invoice_number=f"INV-{tenant.pk}-{uuid.uuid4().hex[:8].upper()}",
                amount=amount,
                due_date=timezone.now().date() + timedelta(days=INVOICE_DUE_IN_DAYS),
                is_paid=False,
            )

            _send_invoice_email(tenant, invoice, breakdown)
            _create_invoice_support_message(tenant, invoice, breakdown)
            processed += 1
        except Exception:
            # One tenant's billing failure should never block the rest of the cycle.
            logger.exception("Failed to generate invoice for tenant %s", tenant.pk)

    logger.info("generate_monthly_invoices: processed %d/%d tenants", processed, len(tenants))
    return processed
