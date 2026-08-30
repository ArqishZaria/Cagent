from django.contrib import admin, messages

from wallet.models import ManualCredit, PricingRate, TenantWallet, WalletTopup, WalletTransaction


@admin.register(PricingRate)
class PricingRateAdmin(admin.ModelAdmin):
    """The actual admin panel for adjusting Telnyx cost pass-through rates."""
    list_display = ("key", "cost_usd", "unit", "is_active", "updated_by", "updated_at")
    list_editable = ("cost_usd", "is_active")
    readonly_fields = ("updated_at",)

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(TenantWallet)
class TenantWalletAdmin(admin.ModelAdmin):
    list_display = ("tenant", "balance_usd", "low_balance_threshold_usd", "updated_at")
    search_fields = ("tenant__company_name",)
    readonly_fields = ("updated_at",)


@admin.register(WalletTopup)
class WalletTopupAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "tenant", "usd_amount_requested", "net_credited_usd", "status", "paid_at")
    list_filter = ("status",)
    search_fields = ("tenant__company_name", "invoice_number", "gateway_order_id")
    readonly_fields = ("created_at", "paid_at")


@admin.register(ManualCredit)
class ManualCreditAdmin(admin.ModelAdmin):
    """
    How you credit a wallet after verifying a bank/SadaPay transfer
    screenshot sent via Support Chat: fill in tenant, amount, the date they
    say they paid, and an optional note, then Save. Saving a NEW record
    immediately credits the wallet via WalletTransaction.apply() — every
    field then locks (see get_readonly_fields) so this can't be edited into
    a double-credit later. To correct a mistake, add a new ManualCredit
    (to add more) or a manual ADJUSTMENT in WalletTransaction directly (to
    subtract) — never edit an existing ManualCredit.
    """

    list_display = ("tenant", "amount_usd", "transfer_date", "processed_by", "created_at")
    list_filter = ("tenant",)
    search_fields = ("tenant__company_name", "reference_note")

    def get_readonly_fields(self, request, obj=None):
        if obj:  # already saved — lock everything
            return ("tenant", "amount_usd", "transfer_date", "reference_note", "processed_by", "created_at")
        return ("processed_by", "created_at")

    def has_delete_permission(self, request, obj=None):
        # Deleting wouldn't reverse the WalletTransaction it created, which
        # would silently desync the ledger from what actually happened —
        # corrections go through a new ManualCredit or ADJUSTMENT instead.
        return False

    def save_model(self, request, obj, form, change):
        creating = obj.pk is None
        if creating:
            obj.processed_by = request.user

        super().save_model(request, obj, form, change)

        if creating:
            WalletTransaction.apply(
                tenant=obj.tenant,
                type=WalletTransaction.Type.TOPUP,
                amount_usd=obj.amount_usd,
                description="Wallet credited via manual bank transfer",
                related_manual_credit=obj,
            )
            self.message_user(
                request,
                f"Credited ${obj.amount_usd} to {obj.tenant.company_name}'s wallet.",
                messages.SUCCESS,
            )


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ("tenant", "type", "amount_usd", "balance_after_usd", "created_at")
    list_filter = ("type", "tenant")
    search_fields = ("tenant__company_name", "description")
    readonly_fields = ("created_at",)