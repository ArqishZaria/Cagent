"""
All wallet money-math and billing lives here. Every call site elsewhere in
the codebase (telephony, scraper, crm) imports from this module rather than
touching WalletTransaction or PricingRate directly — one place to get the
math right.
"""

import logging
import math
import re
import uuid
from decimal import ROUND_HALF_UP, Decimal

import requests
from django.conf import settings
from django.utils import timezone
from django.utils.module_loading import import_string

from wallet.models import PricingRate, TenantWallet, WalletTopup, WalletTransaction

logger = logging.getLogger(__name__)

TWO_PLACES = Decimal("0.01")


class InsufficientBalance(Exception):
    def __init__(self, required, available):
        self.required = required
        self.available = available
        super().__init__(f"Insufficient wallet balance: need ${required}, have ${available}")


def get_gateway():
    return import_string(settings.WALLET_GATEWAY_CLASS)()


# --- FX + fee math ---------------------------------------------------------------------


def get_usd_to_pkr_rate() -> Decimal:
    resp = requests.get(settings.FX_RATE_API_URL, timeout=10)
    resp.raise_for_status()
    rate = resp.json()["rates"]["PKR"]
    return Decimal(str(rate))


def calculate_platform_fee(usd_amount: Decimal) -> Decimal:
    """Flat $2 under $10, else 20% — this is OUR fee, deducted from the wallet credit."""
    if usd_amount < Decimal("10.00"):
        return Decimal("2.00")
    return (usd_amount * Decimal("0.20")).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


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
    """
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


def bill_usage(tenant, *, type, cost_usd: Decimal, description="", **refs) -> WalletTransaction:
    txn = WalletTransaction.apply(
        tenant=tenant, type=type, amount_usd=-cost_usd, description=description, **refs,
    )
    wallet = TenantWallet.objects.get(tenant=tenant)
    if wallet.low_balance_notified_at and wallet.balance_usd <= wallet.low_balance_threshold_usd:
        from wallet.notifications import notify_low_balance
        notify_low_balance(wallet)
    return txn


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
        return  # already billed — guards against a webhook retry double-charging

    minutes = max(1, math.ceil(interaction.duration_seconds / 60))
    key = (
        PricingRate.Key.CALL_INBOUND_PER_MINUTE
        if interaction.direction == interaction.Direction.INBOUND
        else PricingRate.Key.CALL_OUTBOUND_PER_MINUTE
    )
    per_minute = PricingRate.get_cost(key)
    cost = (per_minute * minutes).quantize(Decimal("0.0001"))

    bill_usage(
        interaction.tenant,
        type=WalletTransaction.Type.USAGE_CALL,
        cost_usd=cost,
        description=f"{interaction.direction.title()} call — {minutes} min",
        related_interaction=interaction,
        related_phone_number=interaction.phone_number,
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

    bill_usage(
        interaction.tenant,
        type=WalletTransaction.Type.USAGE_SMS,
        cost_usd=cost,
        description=f"{interaction.direction.title()} SMS — {segments} segment(s)",
        related_interaction=interaction,
        related_phone_number=interaction.phone_number,
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
    bill_usage(
        tenant,
        type=WalletTransaction.Type.USAGE_LEAD_SEARCH,
        cost_usd=cost,
        description=f'Prospector search: "{scrape_task.query}" — {total_leads_returned} leads',
        related_scrape_task=scrape_task,
    )