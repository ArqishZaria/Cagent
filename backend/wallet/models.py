"""
Prepaid wallet system — replaces the old postpaid billing app.

TenantWallet.balance_usd is NEVER written to directly outside of
WalletTransaction.apply(); it's always the sum of every transaction for
that tenant, so the ledger and the balance can never drift apart.
"""

from decimal import Decimal

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from core.models import CustomUser, Tenant


class TenantWallet(models.Model):
    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name="wallet")
    balance_usd = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0.0000"))
    low_balance_threshold_usd = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("1.00"))
    # Set the moment balance crosses <= threshold; cleared once it's topped
    # back up above threshold, so the boss gets exactly one warning per dip,
    # not one per subsequent $0.007 call deduction.
    low_balance_notified_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.tenant.company_name} — ${self.balance_usd}"

    def has_sufficient_balance(self, amount_usd: Decimal) -> bool:
        return self.balance_usd >= amount_usd


class PricingRate(models.Model):
    """
    Admin-editable cost table. Every usage-deduction call site looks up its
    cost here at the moment of billing — nothing is ever hardcoded. Only the
    platform owner (Django admin / staff) can edit; tenant ADMINs get
    read-only access via a serializer (see wallet.views, Step 2).
    """

    class Key(models.TextChoices):
        CALL_OUTBOUND_PER_MINUTE = "call_outbound_per_minute", "Outbound call — per minute"
        CALL_INBOUND_PER_MINUTE = "call_inbound_per_minute", "Inbound call — per minute"
        SMS_PER_SEGMENT = "sms_per_segment", "SMS — per segment"
        NUMBER_MONTHLY_RENTAL = "number_monthly_rental", "Phone number — monthly rental"
        NUMBER_SMS_CAPABILITY_FEE = "number_sms_capability_fee", "Phone number — SMS capability add-on (monthly)"
        TEN_DLC_CAMPAIGN_FEE = "ten_dlc_campaign_fee", "10DLC campaign fee (monthly)"
        LEAD_SEARCH_PER_QUERY = "lead_search_per_query", "Prospector web search — per query"
        LEAD_VERIFICATION_PER_ROW = "lead_verification_per_row", "Bulk upload — per-row verification"

    key = models.CharField(max_length=64, choices=Key.choices, unique=True)
    cost_usd = models.DecimalField(max_digits=8, decimal_places=4)
    unit = models.CharField(max_length=32, default="per minute")
    is_active = models.BooleanField(default=True)
    updated_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return f"{self.get_key_display()} — ${self.cost_usd}"

    @classmethod
    def get_cost(cls, key: str) -> Decimal:
        try:
            return cls.objects.get(key=key, is_active=True).cost_usd
        except cls.DoesNotExist:
            raise ValueError(f"No active PricingRate configured for '{key}' — set it in the admin panel first.")


class WalletTopup(models.Model):
    """One row per Raast/PayFast top-up attempt, successful or not."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PAID = "PAID", "Paid"
        EXPIRED = "EXPIRED", "Expired"
        FAILED = "FAILED", "Failed"

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="wallet_topups")
    requested_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)

    usd_amount_requested = models.DecimalField(max_digits=10, decimal_places=2)
    fx_rate_used = models.DecimalField(max_digits=10, decimal_places=4)
    pkr_base_amount = models.DecimalField(max_digits=12, decimal_places=2)
    gateway_fee_pkr = models.DecimalField(max_digits=10, decimal_places=2)
    total_charged_pkr = models.DecimalField(max_digits=12, decimal_places=2)

    # Computed only once status flips to PAID
    platform_fee_usd = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    net_credited_usd = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    gateway_order_id = models.CharField(max_length=128, unique=True)
    gateway_reference = models.CharField(max_length=128, blank=True)
    qr_payload = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    invoice_number = models.CharField(max_length=64, blank=True, unique=True, null=True)
    invoice_pdf = models.FileField(upload_to="wallet_invoices/", blank=True, null=True)

    expires_at = models.DateTimeField()
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.tenant.company_name} — ${self.usd_amount_requested} ({self.status})"

    def platform_fee_for(self, amount: Decimal) -> Decimal:
        if amount < Decimal("10.00"):
            return Decimal("2.00")
        return (amount * Decimal("0.20")).quantize(Decimal("0.01"))


class ManualCredit(models.Model):
    """
    Audit record for a manually-verified bank/SadaPay transfer top-up.

    Created once by the platform owner in Django admin after confirming a
    tenant's transfer proof (a screenshot sent via Support Chat) — saving a
    NEW ManualCredit immediately calls WalletTransaction.apply() to credit
    the wallet, so the balance and the ledger can never drift apart.

    Once saved, every field becomes read-only in the admin (see
    wallet.admin.ManualCreditAdmin) to prevent accidental double-crediting
    via a later edit — a correction should be a new ManualCredit (to add
    more) or a manual ADJUSTMENT WalletTransaction (to subtract), never an
    edit to an existing ManualCredit.
    """

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="manual_credits")
    amount_usd = models.DecimalField(max_digits=10, decimal_places=2)
    transfer_date = models.DateField(help_text="Date the tenant says they sent the bank/SadaPay transfer.")
    reference_note = models.CharField(
        max_length=255,
        blank=True,
        help_text="e.g. 'Screenshot in support chat' or a bank transaction reference.",
    )
    processed_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Which platform-owner admin verified and entered this credit.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.tenant.company_name} — ${self.amount_usd} ({self.transfer_date})"


class WalletTransaction(models.Model):
    """
    Append-only ledger. This table IS the source of truth for both the
    wallet balance and every number shown on the Track Finances tab —
    never edited or deleted, only inserted via WalletTransaction.apply().
    """

    class Type(models.TextChoices):
        TOPUP = "TOPUP", "Top-up"
        USAGE_CALL = "USAGE_CALL", "Call"
        USAGE_SMS = "USAGE_SMS", "SMS"
        USAGE_LEAD_SEARCH = "USAGE_LEAD_SEARCH", "Lead search"
        USAGE_LEAD_VERIFICATION = "USAGE_LEAD_VERIFICATION", "Lead verification"
        USAGE_NUMBER_RENTAL = "USAGE_NUMBER_RENTAL", "Number rental"
        USAGE_OTHER = "USAGE_OTHER", "Other"
        ADJUSTMENT = "ADJUSTMENT", "Manual adjustment"

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="wallet_transactions")
    type = models.CharField(max_length=24, choices=Type.choices)
    amount_usd = models.DecimalField(max_digits=10, decimal_places=4)  # signed: + for TOPUP/ADJUSTMENT credit, - for USAGE_*
    balance_after_usd = models.DecimalField(max_digits=12, decimal_places=4)

    related_topup = models.ForeignKey(WalletTopup, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions")
    related_manual_credit = models.ForeignKey(ManualCredit, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions")
    related_interaction = models.ForeignKey("core.Interaction", on_delete=models.SET_NULL, null=True, blank=True)
    related_phone_number = models.ForeignKey("core.PhoneNumber", on_delete=models.SET_NULL, null=True, blank=True)
    related_scrape_task = models.ForeignKey("core.ScrapeTask", on_delete=models.SET_NULL, null=True, blank=True)

    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["tenant", "type", "created_at"])]

    def __str__(self):
        return f"{self.tenant.company_name} {self.type} {self.amount_usd}"

    @classmethod
    @transaction.atomic
    def apply(cls, *, tenant, type, amount_usd: Decimal, description="", **refs):
        """
        The ONLY way balance should ever change. Locks the wallet row,
        recomputes balance_after from the locked value, writes the
        transaction, saves the wallet — all inside one atomic block so two
        concurrent debits (e.g. a call hangup and an SMS send landing at
        the same instant) can never race each other into an inconsistent
        balance.

        Low-balance notification fires exactly once per dip: the moment
        balance first crosses <= threshold, right here where the crossing
        is actually detected — not left for callers to infer afterward from
        low_balance_notified_at's truthiness, since that flag stays non-null
        for the whole duration of the dip and would otherwise fire on every
        subsequent transaction, not just the first one.
        """
        wallet = TenantWallet.objects.select_for_update().get(tenant=tenant)
        new_balance = wallet.balance_usd + amount_usd
        txn = cls.objects.create(
            tenant=tenant, type=type, amount_usd=amount_usd,
            balance_after_usd=new_balance, description=description, **refs,
        )
        wallet.balance_usd = new_balance

        just_crossed_low = False
        if new_balance <= wallet.low_balance_threshold_usd:
            if wallet.low_balance_notified_at is None:
                wallet.low_balance_notified_at = timezone.now()
                just_crossed_low = True
        else:
            wallet.low_balance_notified_at = None

        wallet.save(update_fields=["balance_usd", "low_balance_notified_at", "updated_at"])

        if just_crossed_low:
            from wallet.notifications import notify_low_balance
            notify_low_balance(wallet)

        return txn