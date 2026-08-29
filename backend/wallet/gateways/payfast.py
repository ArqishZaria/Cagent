"""
PayFast Raast P2M dynamic QR integration.

NOTE: PayFast's exact endpoint paths / request field names are on their
merchant API docs (issued when you're onboarded) — the shape below follows
their publicly documented Dynamic QR + webhook pattern (create QR ->
customer scans -> instant webhook), but confirm exact field names against
your merchant dashboard's API reference before going live, and swap the
placeholder URLs for the real ones they give you.
"""

import hashlib
import hmac
import logging
from datetime import timedelta

import requests
from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from wallet.gateways.base import RaastGateway

logger = logging.getLogger(__name__)

QR_EXPIRY_MINUTES = 5


class PayFastGateway(RaastGateway):
    def create_dynamic_qr(self, *, order_id, amount_pkr, description):
        resp = requests.post(
            f"{settings.PAYFAST_API_BASE}/raast/qr/dynamic",
            headers={
                "Authorization": f"Bearer {settings.PAYFAST_SECURED_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "merchant_id": settings.PAYFAST_MERCHANT_ID,
                "order_id": order_id,
                "amount": str(amount_pkr),
                "currency": "PKR",
                "description": description,
                "webhook_url": settings.PAYFAST_WEBHOOK_URL,
            },
            timeout=15,
        )
        if resp.status_code >= 400:
            logger.error("PayFast QR creation failed: %s %s", resp.status_code, resp.text)
            raise RuntimeError(f"PayFast QR creation failed: {resp.status_code}")

        data = resp.json()
        return {
            "qr_payload": data["qr_code"],
            "gateway_reference": data["transaction_id"],
            "expires_at": timezone.now() + timedelta(minutes=QR_EXPIRY_MINUTES),
        }

    def verify_webhook(self, request):
        signature = request.headers.get("X-PayFast-Signature", "")
        computed = hmac.new(
            settings.PAYFAST_SECURED_KEY.encode(), request.body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, computed):
            raise PermissionDenied("Invalid PayFast webhook signature.")

        import json
        payload = json.loads(request.body)
        return {
            "order_id": payload["order_id"],
            "status": payload["status"],  # expect "COMPLETED" / "FAILED" / "EXPIRED"
            "gateway_reference": payload.get("transaction_id", ""),
        }