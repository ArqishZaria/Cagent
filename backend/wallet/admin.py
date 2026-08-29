from django.contrib import admin

from wallet.models import PricingRate, TenantWallet, WalletTopup, WalletTransaction


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


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ("tenant", "type", "amount_usd", "balance_after_usd", "created_at")
    list_filter = ("type", "tenant")
    search_fields = ("tenant__company_name", "description")
    readonly_fields = ("created_at",)