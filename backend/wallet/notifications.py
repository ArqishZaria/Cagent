import logging

from django.conf import settings
from django.core.mail import send_mail

from core.models import CustomUser

logger = logging.getLogger(__name__)


def _platform_owner_recipients():
    # Your own inbox(es) — configured once, not per-tenant.
    return settings.PLATFORM_OWNER_NOTIFICATION_EMAILS


def _tenant_admin_recipients(tenant):
    return list(
        CustomUser.objects.filter(tenant=tenant, role=CustomUser.Role.ADMIN)
        .exclude(email="")
        .values_list("email", flat=True)
    )


def notify_topup_success(topup):
    recipients = _platform_owner_recipients()
    if recipients:
        send_mail(
            subject=f"💰 Wallet top-up — {topup.tenant.company_name} — ${topup.net_credited_usd} credited",
            message=(
                f"Tenant: {topup.tenant.company_name}\n"
                f"Gross: ${topup.usd_amount_requested}\n"
                f"Platform fee: ${topup.platform_fee_usd}\n"
                f"Net credited: ${topup.net_credited_usd}\n"
                f"Charged: Rs. {topup.total_charged_pkr} via Raast\n"
                f"Invoice: {topup.invoice_number}\n"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            fail_silently=True,
        )

    for email in _tenant_admin_recipients(topup.tenant):
        send_mail(
            subject=f"Wallet top-up confirmed — {topup.invoice_number}",
            message=(
                f"Your wallet was credited ${topup.net_credited_usd} "
                f"(${topup.usd_amount_requested} paid, ${topup.platform_fee_usd} platform fee). "
                f"Invoice {topup.invoice_number} is available in your Upload Finance tab."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=True,
        )


def notify_low_balance(wallet):
    recipients = _tenant_admin_recipients(wallet.tenant)
    if not recipients:
        return
    send_mail(
        subject=f"⚠️ cagent wallet low — ${wallet.balance_usd} remaining",
        message=(
            f"Your cagent wallet balance is down to ${wallet.balance_usd}. "
            f"Calls, SMS, and lead searches will stop working once it hits $0. "
            f"Top up any time in the Upload Finance tab."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=recipients,
        fail_silently=True,
    )