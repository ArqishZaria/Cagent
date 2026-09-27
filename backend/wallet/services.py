"""
All wallet money-math and billing lives here. Every call site elsewhere in
the codebase (telephony, scraper, crm) imports from this module rather than
touching WalletTransaction or PricingRate directly — one place to get the
math right.
"""
import calendar
import logging
import math
import re
import uuid
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

import requests
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.module_loading import import_string

from core.models import Tenant
from wallet.models import PricingRate, TenantWallet, WalletTopup, WalletTransaction

logger = logging.getLogger(__name__)

TWO_PLACES = Decimal("0.01")


class InsufficientBalance(Exception):
    def __init__(self, required, available):
        self.required = required
        self.available = available
        super().__init__(f"Insufficient wallet balance: need ${required}, have ${available}")


class PlatformFeeOverdue(Exception):
    """
    Raised by require_platform_fee_current() when a tenant's recurring
    platform fee couldn't be deducted and they're locked out of billable
    actions (calls, SMS, lead search) until they recharge.
    """

    def __init__(self, amount_due):
        self.amount_due = amount_due
        super().__init__(f"Platform fee of ${amount_due} is overdue — recharge the wallet to continue.")


def get_gateway():
    return import_string(settings.WALLET_GATEWAY_CLASS)()


# --- FX + fee math ---------------------------------------------------------------------


class FxRateUnavailable(Exception):
    """Raised when the exchange-rate API can't be reached or its response
    doesn't have the shape we expect — lets callers (TopupQuoteView,
    TopupCreateView) return a clean 503 instead of a raw 500 traceback."""


def get_usd_to_pkr_rate() -> Decimal:
    try:
        resp = requests.get(settings.FX_RATE_API_URL, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        rate = data["rates"]["PKR"]
    except requests.exceptions.RequestException as exc:
        logger.exception("FX rate API request failed")
        raise FxRateUnavailable("Couldn't reach the exchange rate service.") from exc
    except (KeyError, TypeError, ValueError) as exc:
        logger.exception("FX rate API returned an unexpected response shape")
        raise FxRateUnavailable("Exchange rate service returned an unexpected response.") from exc

    try:
        return Decimal(str(rate))
    except Exception as exc:
        logger.exception("FX rate API returned a non-numeric PKR rate: %r", rate)
        raise FxRateUnavailable("Exchange rate service returned an invalid rate.") from exc

def calculate_platform_fee(usd_amount: Decimal) -> Decimal:
    """
    No top-up fee anymore — every dollar requested is credited to the
    wallet in full. Kept as a function (always returning $0.00) rather
    than deleted, so every call site that still reads platform_fee_usd /
    net_credited_usd (start_topup, confirm_topup_paid, TopupQuoteView,
    wallet_invoices PDF) keeps working with zero other changes.
    """
    return Decimal("0.00")

def calculate_topup_breakdown(usd_amount: Decimal) -> dict:
    """
    Everything the frontend needs to show the pre-payment breakdown. The
    gateway fee here is PayFast's own processing fee — borne by the boss on
    top of the PKR charge, separate from our platform fee (which comes out
    of the USD credited to the wallet, not the PKR they pay).
    """
    fx_rate = get_usd_to_pkr_rate()
    pkr_base = (usd_amount * fx_rate).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    gateway_fee_pkr = (pkr_base * settings.PAYFAST_GATEWAY_FEE_PERCENT).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    total_charged_pkr = pkr_base + gateway_fee_pkr
    platform_fee_usd = calculate_platform_fee(usd_amount)
    return {
        "fx_rate": fx_rate,
        "pkr_base": pkr_base,
        "gateway_fee_pkr": gateway_fee_pkr,
        "total_charged_pkr": total_charged_pkr,
        "platform_fee_usd": platform_fee_usd,
        "net_credited_usd": usd_amount - platform_fee_usd,
    }


# --- Top-up lifecycle --------------------------------------------------------------------


def start_topup(tenant, requested_by, usd_amount: Decimal) -> WalletTopup:
    breakdown = calculate_topup_breakdown(usd_amount)
    order_id = f"WT-{tenant.id}-{uuid.uuid4().hex[:10].upper()}"

    qr = get_gateway().create_dynamic_qr(
        order_id=order_id,
        amount_pkr=breakdown["total_charged_pkr"],
        description=f"cagent wallet top-up — {tenant.company_name}",
    )

    return WalletTopup.objects.create(
        tenant=tenant,
        requested_by=requested_by,
        usd_amount_requested=usd_amount,
        fx_rate_used=breakdown["fx_rate"],
        pkr_base_amount=breakdown["pkr_base"],
        gateway_fee_pkr=breakdown["gateway_fee_pkr"],
        total_charged_pkr=breakdown["total_charged_pkr"],
        gateway_order_id=order_id,
        gateway_reference=qr["gateway_reference"],
        qr_payload=qr["qr_payload"],
        expires_at=qr["expires_at"],
    )


def confirm_topup_paid(topup: WalletTopup) -> WalletTopup:
    """
    Idempotent on purpose — a webhook can legitimately fire more than once.

    Locks the WalletTopup row for the duration of the status check + write,
    so two near-simultaneous webhook deliveries for the same top-up can
    never both pass the "not yet PAID" check and double-credit the wallet.
    The second caller blocks on select_for_update() until the first
    transaction commits, then re-reads status as PAID and returns early.

    Everything inside this function must stay inside the atomic block —
    including the re-read of `topup` — or the lock is pointless.
    """
    with transaction.atomic():
        topup = WalletTopup.objects.select_for_update().get(pk=topup.pk)

        if topup.status == WalletTopup.Status.PAID:
            return topup

        platform_fee = calculate_platform_fee(topup.usd_amount_requested)
        net_credited = topup.usd_amount_requested - platform_fee

        topup.status = WalletTopup.Status.PAID
        topup.platform_fee_usd = platform_fee
        topup.net_credited_usd = net_credited
        topup.paid_at = timezone.now()
        topup.invoice_number = f"INV-{topup.tenant_id}-{uuid.uuid4().hex[:8].upper()}"
        topup.save(update_fields=[
            "status", "platform_fee_usd", "net_credited_usd", "paid_at", "invoice_number",
        ])

        WalletTransaction.apply(
            tenant=topup.tenant,
            type=WalletTransaction.Type.TOPUP,
            amount_usd=net_credited,
            description=f"Wallet top-up ({topup.invoice_number}) — ${topup.usd_amount_requested} gross, "
                         f"${platform_fee} platform fee",
            related_topup=topup,
        )

        # If this tenant was locked out on an unpaid recurring platform fee,
        # this top-up may now cover it — try immediately rather than waiting
        # for tomorrow's daily sweep (wallet.tasks.charge_platform_fees).
        try_charge_platform_fee(topup.tenant)

    # PDF generation and email notification are deliberately OUTSIDE the
    # atomic block: they're slow, external-facing side effects (disk I/O,
    # SMTP) that don't need to hold the row lock, and if either one throws,
    # you don't want to roll back a payment that already succeeded.
    from wallet.pdf import generate_topup_invoice_pdf
    from wallet.notifications import notify_topup_success
    generate_topup_invoice_pdf(topup)
    notify_topup_success(topup)

    return topup

# --- Usage billing -----------------------------------------------------------------------


def require_balance(tenant, cost_usd: Decimal):
    wallet = TenantWallet.objects.get(tenant=tenant)
    if not wallet.has_sufficient_balance(cost_usd):
        raise InsufficientBalance(cost_usd, wallet.balance_usd)


def require_platform_fee_current(tenant):
    """
    Raises PlatformFeeOverdue if this tenant is currently locked out of
    billable actions (calls, SMS, lead search) for an unpaid recurring
    platform fee. Deliberately narrow: read-only areas of the app (leads,
    call logs, settings, billing itself) are never gated by this — only
    the billable-action call sites check it.
    """
    if tenant.subscription_status == Tenant.SubscriptionStatus.PAID_OVERDUE:
        cost = PricingRate.get_cost(PricingRate.Key.PLATFORM_FEE_MONTHLY)
        raise PlatformFeeOverdue(cost)


def try_charge_platform_fee(tenant) -> bool:
    """
    Charges the recurring monthly platform fee for `tenant` if (and only
    if) it's currently due. Called from two places:
      - wallet.tasks.charge_platform_fees, the daily beat sweep
      - confirm_topup_paid, immediately after a top-up lands, so an
        overdue tenant is unblocked the instant they recharge rather than
        waiting for tomorrow's sweep

    Locks the Tenant row for the duration so a beat-task run and a
    top-up-triggered call can never both charge the same cycle.

    Returns True if nothing was due, or the due fee was successfully
    charged (tenant is/stays ACTIVE). Returns False if a fee is due but
    the wallet still can't cover it (tenant is/stays PAID_OVERDUE).
    """
    with transaction.atomic():
        locked_tenant = Tenant.objects.select_for_update().get(pk=tenant.pk)

        if (
            locked_tenant.next_platform_fee_charge_at is None
            or locked_tenant.next_platform_fee_charge_at > timezone.now()
        ):
            return True

        cost = PricingRate.get_cost(PricingRate.Key.PLATFORM_FEE_MONTHLY)
        wallet = TenantWallet.objects.get(tenant=locked_tenant)

        if wallet.balance_usd < cost:
            if locked_tenant.subscription_status != Tenant.SubscriptionStatus.PAID_OVERDUE:
                locked_tenant.subscription_status = Tenant.SubscriptionStatus.PAID_OVERDUE
                locked_tenant.save(update_fields=["subscription_status"])
                from wallet.notifications import notify_platform_fee_overdue
                notify_platform_fee_overdue(locked_tenant, cost)
            return False

        bill_usage(
            locked_tenant,
            type=WalletTransaction.Type.USAGE_PLATFORM_FEE,
            cost_usd=cost,
            description="Monthly platform fee",
        )
        locked_tenant.next_platform_fee_charge_at = timezone.now() + timedelta(days=30)
        locked_tenant.subscription_status = Tenant.SubscriptionStatus.ACTIVE
        locked_tenant.save(update_fields=["next_platform_fee_charge_at", "subscription_status"])
        return True

def bill_usage(tenant, *, type, cost_usd: Decimal, description="", **refs) -> WalletTransaction:
    
    return WalletTransaction.apply(
        tenant=tenant, type=type, amount_usd=-cost_usd, description=description, **refs,
    )

def count_sms_segments(text: str) -> int:
    """
    Rough GSM-7 vs UCS-2 segment estimate — good enough for cost purposes.
    Non-GSM-7 characters (emoji, most non-Latin scripts) force UCS-2 (70
    chars/segment, 67 when concatenated); plain GSM-7 gets 160/153.
    """
    text = text or ""
    is_gsm7 = bool(re.match(r"^[\x00-\x7F£€¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!\"#$%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà]*$", text))
    if not text:
        return 1
    if is_gsm7:
        return 1 if len(text) <= 160 else math.ceil(len(text) / 153)
    return 1 if len(text) <= 70 else math.ceil(len(text) / 67)


def bill_call(interaction):
    if interaction.type != interaction.Type.CALL or not interaction.duration_seconds:
        return
    if WalletTransaction.objects.filter(related_interaction=interaction).exists():
        return  # fast pre-check, avoids a round trip in the common case

    minutes = max(1, math.ceil(interaction.duration_seconds / 60))
    key = (
        PricingRate.Key.CALL_INBOUND_PER_MINUTE
        if interaction.direction == interaction.Direction.INBOUND
        else PricingRate.Key.CALL_OUTBOUND_PER_MINUTE
    )
    per_minute = PricingRate.get_cost(key)
    cost = (per_minute * minutes).quantize(Decimal("0.0001"))

    try:
        bill_usage(
            interaction.tenant,
            type=WalletTransaction.Type.USAGE_CALL,
            cost_usd=cost,
            description=f"{interaction.direction.title()} call — {minutes} min",
            related_interaction=interaction,
            related_phone_number=interaction.phone_number,
        )
    except IntegrityError:
        logger.info(
            "bill_call: interaction %s already billed concurrently — skipped duplicate charge.",
            interaction.id,
        )


def bill_sms(interaction):
    if interaction.type != interaction.Type.SMS:
        return
    if WalletTransaction.objects.filter(related_interaction=interaction).exists():
        return

    segments = count_sms_segments(interaction.message_body)
    rate_key = (
        PricingRate.Key.SMS_INBOUND_PER_SEGMENT
        if interaction.direction == interaction.Direction.INBOUND
        else PricingRate.Key.SMS_OUTBOUND_PER_SEGMENT
    )
    per_segment = PricingRate.get_cost(rate_key)
    cost = (per_segment * segments).quantize(Decimal("0.0001"))

    try:
        bill_usage(
            interaction.tenant,
            type=WalletTransaction.Type.USAGE_SMS,
            cost_usd=cost,
            description=f"{interaction.direction.title()} SMS — {segments} segment(s)",
            related_interaction=interaction,
            related_phone_number=interaction.phone_number,
        )
    except IntegrityError:
        logger.info(
            "bill_sms: interaction %s already billed concurrently — skipped duplicate charge.",
            interaction.id,
        )


def bill_lead_search(tenant, scrape_task, total_leads_returned: int):
    """
    Flat $2.50 charged ONCE the search actually completes and returns at
    least one lead (existing-in-tenant matches + master-pool pulls +
    freshly-scraped, combined). A zero-result search costs nothing.
    Idempotent via related_scrape_task, same pattern as bill_call.
    """
    if total_leads_returned <= 0:
        return
    if WalletTransaction.objects.filter(related_scrape_task=scrape_task).exists():
        return

    cost = PricingRate.get_cost(PricingRate.Key.LEAD_SEARCH_PER_QUERY)
    try:
        bill_usage(
            tenant,
            type=WalletTransaction.Type.USAGE_LEAD_SEARCH,
            cost_usd=cost,
            description=f'Prospector search: "{scrape_task.query}" — {total_leads_returned} leads',
            related_scrape_task=scrape_task,
        )
    except IntegrityError:
        logger.info(
            "bill_lead_search: scrape_task %s already billed concurrently — skipped duplicate charge.",
            scrape_task.id,
        )
    
def calculate_number_purchase_cost() -> Decimal:
    """
    The PRORATED cost of purchasing a number today: full monthly rental +
    SMS capability fee, scaled to the days remaining in the current
    calendar month (day 1 of a 30-day month -> 30/30, full price; day 30
    -> 1/30, one day's worth). Shared by the pre-purchase balance check
    (telephony.views.NumberPurchaseView) and the actual charge below
    (bill_number_purchase), so the same number is checked and charged —
    a tenant can never pass the balance check and then fail the real bill.
    """
    rental_cost = PricingRate.get_cost(PricingRate.Key.NUMBER_MONTHLY_RENTAL)
    sms_fee = PricingRate.get_cost(PricingRate.Key.NUMBER_SMS_CAPABILITY_FEE)
    full_month_cost = rental_cost + sms_fee

    today = timezone.now().date()
    days_in_month = calendar.monthrange(today.year, today.month)[1]
    days_remaining = days_in_month - today.day + 1
    fraction = Decimal(days_remaining) / Decimal(days_in_month)

    return (full_month_cost * fraction).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def bill_number_purchase(phone_number):
    """
    Charges a PRORATED first month's rental + SMS capability fee — only
    for the days remaining in the calendar month from the purchase date —
    then stamps last_billed_at to the 1st of that month so the monthly
    sweep (wallet.tasks.charge_monthly_number_rentals) correctly charges
    the FULL rate starting next month, without re-billing this partial one.
    """
    today = timezone.now().date()
    days_in_month = calendar.monthrange(today.year, today.month)[1]
    days_remaining = days_in_month - today.day + 1
    cost = calculate_number_purchase_cost()

    bill_usage(
        phone_number.tenant,
        type=WalletTransaction.Type.USAGE_NUMBER_RENTAL,
        cost_usd=cost,
        description=(
            f"Number purchase — prorated first month rental "
            f"({days_remaining}/{days_in_month} days) — {phone_number.phone_number}"
        ),
        related_phone_number=phone_number,
    )
    phone_number.last_billed_at = today.replace(day=1)
    phone_number.save(update_fields=["last_billed_at"])