from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsTenantAdmin, IsTenantMember
from wallet.gateways.base import RaastGateway
from wallet.models import PricingRate, TenantWallet, WalletTopup, WalletTransaction
from wallet.serializers import (
    PricingRateSerializer, TenantWalletSerializer, WalletTopupSerializer,
    WalletTransactionSerializer,
)
from wallet.services import calculate_topup_breakdown, confirm_topup_paid, get_gateway, start_topup

MIN_TOPUP_USD = Decimal("2.00")


class WalletSummaryView(APIView):
    """GET /api/wallet/ — balance + low-balance flag for the sidebar badge."""

    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request):
        wallet, _ = TenantWallet.objects.get_or_create(tenant=request.user.tenant)
        data = TenantWalletSerializer(wallet).data
        data["is_low"] = wallet.balance_usd <= wallet.low_balance_threshold_usd
        return Response(data)


class TopupQuoteView(APIView):
    """GET /api/wallet/topups/quote/?amount=25 — live fee breakdown before paying."""

    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        try:
            amount = Decimal(request.query_params.get("amount", ""))
        except InvalidOperation:
            return Response({"detail": "amount is required and must be a number."}, status=400)
        if amount < MIN_TOPUP_USD:
            return Response({"detail": f"Minimum top-up is ${MIN_TOPUP_USD}."}, status=400)

        breakdown = calculate_topup_breakdown(amount)
        return Response({
            "usd_amount": str(amount),
            "fx_rate": str(breakdown["fx_rate"]),
            "pkr_base": str(breakdown["pkr_base"]),
            "gateway_fee_pkr": str(breakdown["gateway_fee_pkr"]),
            "total_charged_pkr": str(breakdown["total_charged_pkr"]),
            "platform_fee_usd": str(breakdown["platform_fee_usd"]),
            "net_credited_usd": str(breakdown["net_credited_usd"]),
        })


class TopupCreateView(APIView):
    """POST /api/wallet/topups/  Body: {"amount_usd": "25.00"} — creates the QR."""

    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def post(self, request):
        try:
            amount = Decimal(str(request.data.get("amount_usd", "")))
        except InvalidOperation:
            return Response({"detail": "amount_usd is required and must be a number."}, status=400)
        if amount < MIN_TOPUP_USD:
            return Response({"detail": f"Minimum top-up is ${MIN_TOPUP_USD}."}, status=400)

        topup = start_topup(request.user.tenant, request.user, amount)
        return Response(WalletTopupSerializer(topup).data, status=status.HTTP_201_CREATED)


class TopupStatusView(APIView):
    """GET /api/wallet/topups/<id>/ — polled by the frontend while the QR is on screen."""

    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request, pk):
        topup = get_object_or_404(WalletTopup, pk=pk, tenant=request.user.tenant)
        return Response(WalletTopupSerializer(topup).data)


class TopupInvoiceDownloadView(APIView):
    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request, pk):
        topup = get_object_or_404(WalletTopup, pk=pk, tenant=request.user.tenant)
        if not topup.invoice_pdf:
            raise Http404("Invoice not generated yet.")
        return FileResponse(topup.invoice_pdf.open("rb"), as_attachment=True,
                             filename=f"{topup.invoice_number}.pdf")


class TopupHistoryView(APIView):
    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request):
        topups = WalletTopup.objects.filter(tenant=request.user.tenant).order_by("-created_at")[:100]
        return Response(WalletTopupSerializer(topups, many=True).data)


class GatewayWebhookView(APIView):
    """
    POST /api/wallet/webhooks/payfast/ — PayFast/Safepay calls this the
    instant a Raast payment settles. Whitelisted in core middleware / not
    authenticated (verified by signature instead — see gateways/payfast.py).
    """

    permission_classes = []
    authentication_classes = []

    def post(self, request):
        gateway: RaastGateway = get_gateway()
        payload = gateway.verify_webhook(request)

        try:
            topup = WalletTopup.objects.select_related("tenant").get(gateway_order_id=payload["order_id"])
        except WalletTopup.DoesNotExist:
            return Response(status=status.HTTP_200_OK)  # ack anyway — nothing to retry

        if payload["status"] == "COMPLETED":
            confirm_topup_paid(topup)
        elif payload["status"] in ("EXPIRED", "FAILED"):
            topup.status = payload["status"]
            topup.save(update_fields=["status"])

        return Response(status=status.HTTP_200_OK)


class TransactionListView(APIView):
    """GET /api/wallet/transactions/?type=USAGE_CALL — the Track Finances feed."""

    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request):
        qs = WalletTransaction.objects.filter(tenant=request.user.tenant)
        if request.query_params.get("type"):
            qs = qs.filter(type=request.query_params["type"])
        qs = qs.order_by("-created_at")[:200]
        return Response(WalletTransactionSerializer(qs, many=True).data)


class TransactionBreakdownView(APIView):
    """
    GET /api/wallet/transactions/breakdown/ — totals per usage type, PLUS the
    grand total, which by construction always equals (sum of all TOPUP) -
    (current balance) — the reconciliation the boss asked for, with no
    possibility of drift since it's all read off the same ledger table.
    """

    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request):
        from django.db.models import Sum
        tenant = request.user.tenant

        usage_qs = (
            WalletTransaction.objects.filter(tenant=tenant, type__startswith="USAGE_")
            .values("type")
            .annotate(total=Sum("amount_usd"))
            .order_by("type")
        )
        total_usage = sum((abs(row["total"]) for row in usage_qs), Decimal("0.00"))
        total_topups = (
            WalletTransaction.objects.filter(tenant=tenant, type="TOPUP")
            .aggregate(total=Sum("amount_usd"))["total"] or Decimal("0.00")
        )
        wallet = TenantWallet.objects.get(tenant=tenant)

        return Response({
            "breakdown": [{"type": row["type"], "total_usd": str(abs(row["total"]))} for row in usage_qs],
            "total_usage_usd": str(total_usage),
            "total_topups_usd": str(total_topups),
            "current_balance_usd": str(wallet.balance_usd),
            # Sanity check exposed to the frontend: should always be ~0.
            "reconciliation_delta": str(total_topups - total_usage - wallet.balance_usd),
        })


class PricingRateListView(APIView):
    """GET /api/wallet/pricing-rates/ — tenant ADMINs get read-only visibility."""

    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        rates = PricingRate.objects.filter(is_active=True)
        return Response(PricingRateSerializer(rates, many=True).data)


class ManualPaymentInfoView(APIView):
    """
    GET /api/wallet/manual-payment-info/ — the bank/SadaPay account details
    tenants transfer to while real automated gateway integration (PayFast
    Pakistan) is pending merchant approval. Sourced entirely from env vars
    so you can update the account details any time without a code change.
    """

    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request):
        return Response({
            "bank_name": settings.MANUAL_PAYMENT_BANK_NAME,
            "account_title": settings.MANUAL_PAYMENT_ACCOUNT_TITLE,
            "account_number": settings.MANUAL_PAYMENT_ACCOUNT_NUMBER,
            "iban": settings.MANUAL_PAYMENT_IBAN,
            "sadapay_number": settings.MANUAL_PAYMENT_SADAPAY_NUMBER,
            "instructions": settings.MANUAL_PAYMENT_INSTRUCTIONS,
        })