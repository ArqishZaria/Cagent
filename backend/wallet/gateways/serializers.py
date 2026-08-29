from rest_framework import serializers

from wallet.models import PricingRate, TenantWallet, WalletTopup, WalletTransaction


class TenantWalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantWallet
        fields = ("balance_usd", "low_balance_threshold_usd", "updated_at")


class WalletTopupSerializer(serializers.ModelSerializer):
    invoice_url = serializers.SerializerMethodField()

    class Meta:
        model = WalletTopup
        fields = (
            "id", "usd_amount_requested", "fx_rate_used", "pkr_base_amount",
            "gateway_fee_pkr", "total_charged_pkr", "platform_fee_usd",
            "net_credited_usd", "status", "qr_payload", "expires_at",
            "invoice_number", "invoice_url", "paid_at", "created_at",
        )
        read_only_fields = fields

    def get_invoice_url(self, obj):
        if obj.invoice_pdf:
            return f"/api/wallet/topups/{obj.id}/invoice/"
        return None


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = ("id", "type", "amount_usd", "balance_after_usd", "description", "created_at")


class PricingRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PricingRate
        fields = ("key", "label", "cost_usd", "unit", "is_active", "updated_at")

    label = serializers.CharField(source="get_key_display", read_only=True)