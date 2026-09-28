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
from wallet.services import FxRateUnavailable, calculate_topup_breakdown, confirm_topup_paid, get_gateway, start_topup
MIN_TOPUP_USD = Decimal("2.00")

# ACCESS RULE for this module: company-wide financial DETAIL (transaction
# ledger, spend breakdown, top-up records, invoices, rates) is ADMIN-only.
# The only things any tenant member may read are the wallet BALANCE summary
# (WalletSummaryView — needed for the low-balance / overdue banners and to
# know whether calling is possible) and the manual bank-transfer
# instructions (ManualPaymentInfoView — not sensitive, shown on Billing).


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

        try:
            breakdown = calculate_topup_breakdown(amount)
        except FxRateUnavailable as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

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

        try:
            topup = start_topup(request.user.tenant, request.user, amount)
        except FxRateUnavailable as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response(WalletTopupSerializer(topup).data, status=status.HTTP_201_CREATED)

class TopupStatusView(APIView):
    """GET /api/wallet/topups/<id>/ — polled by the frontend while the QR is on screen. ADMIN-only (same as the endpoints that create it)."""

    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request, pk):
        topup = get_object_or_404(WalletTopup, pk=pk, tenant=request.user.tenant)
        return Response(WalletTopupSerializer(topup).data)


class TopupInvoiceDownloadView(APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request, pk):
        topup = get_object_or_404(WalletTopup, pk=pk, tenant=request.user.tenant)
        if not topup.invoice_pdf:
            raise Http404("Invoice not generated yet.")
        return FileResponse(topup.invoice_pdf.open("rb"), as_attachment=True,
                             filename=f"{topup.invoice_number}.pdf")


class TopupHistoryView(APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

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
        
        
        
class WalletSummaryView(APIView):
    """
    Deliberately stays IsTenantMember (NOT admin-only): the balance and
    overdue flags drive the portal-wide low-balance / platform-fee banners
    and tell every user whether calling/texting is currently possible.
    Contains no transaction-level detail.
    """

    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request):
        wallet, _ = TenantWallet.objects.get_or_create(tenant=request.user.tenant)
        data = TenantWalletSerializer(wallet).data
        data["is_low"] = wallet.balance_usd <= wallet.low_balance_threshold_usd

        tenant = request.user.tenant
        data["platform_fee_overdue"] = tenant.subscription_status == tenant.SubscriptionStatus.PAID_OVERDUE
        data["next_platform_fee_charge_at"] = tenant.next_platform_fee_charge_at
        try:
            data["platform_fee_amount_usd"] = str(PricingRate.get_cost(PricingRate.Key.PLATFORM_FEE_MONTHLY))
        except ValueError:
            data["platform_fee_amount_usd"] = None
        return Response(data)
    
        
class TransactionListView(APIView):
    """ADMIN-only: full ledger of every top-up and usage charge for the company."""

    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        qs = WalletTransaction.objects.filter(tenant=request.user.tenant)
        if request.query_params.get("type"):
            qs = qs.filter(type=request.query_params["type"])
        if request.query_params.get("date_from"):
            qs = qs.filter(created_at__date__gte=request.query_params["date_from"])
        if request.query_params.get("date_to"):
            qs = qs.filter(created_at__date__lte=request.query_params["date_to"])
        qs = qs.order_by("-created_at")[:200]
        return Response(WalletTransactionSerializer(qs, many=True).data)


class TransactionBreakdownView(APIView):
    """ADMIN-only: company-wide spend breakdown and reconciliation."""

    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        from django.db.models import Sum
        tenant = request.user.tenant
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        date_filtered = bool(date_from or date_to)

        def apply_date_filter(qs):
            if date_from:
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(created_at__date__lte=date_to)
            return qs

        usage_qs = apply_date_filter(
            WalletTransaction.objects.filter(tenant=tenant, type__startswith="USAGE_")
        ).values("type").annotate(total=Sum("amount_usd")).order_by("type")

        total_usage = sum((abs(row["total"]) for row in usage_qs), Decimal("0.00"))

        # Topups and adjustments are now filtered by the SAME date range as
        # usage above, so every total on this response describes the same
        # time window — previously these two stayed lifetime-scoped even
        # when usage was windowed, silently mixing time periods on one screen.
        total_topups = (
            apply_date_filter(WalletTransaction.objects.filter(tenant=tenant, type="TOPUP"))
            .aggregate(total=Sum("amount_usd"))["total"] or Decimal("0.00")
        )
        total_adjustments = (
            apply_date_filter(WalletTransaction.objects.filter(tenant=tenant, type="ADJUSTMENT"))
            .aggregate(total=Sum("amount_usd"))["total"] or Decimal("0.00")
        )

        wallet = TenantWallet.objects.get(tenant=tenant)

        # current_balance_usd is inherently "right now" — it can never be
        # scoped to a past date range, so reconciling it against a windowed
        # total_topups/total_usage would be comparing different time
        # periods no matter how the numbers above are filtered. Only
        # compute/return it when no date filter is applied, where it's the
        # correct lifetime check (topups + adjustments - usage == balance);
        # otherwise return null rather than a number that LOOKS valid but isn't.
        reconciliation_delta = None
        if not date_filtered:
            reconciliation_delta = total_topups + total_adjustments - total_usage - wallet.balance_usd

        return Response({
            "breakdown": [{"type": r["type"], "total_usd": str(abs(r["total"]))} for r in usage_qs],
            "total_usage_usd": str(total_usage),
            "total_topups_usd": str(total_topups),
            "current_balance_usd": str(wallet.balance_usd),
            "reconciliation_delta": str(reconciliation_delta) if reconciliation_delta is not None else None,
            "is_date_filtered": date_filtered,
        })