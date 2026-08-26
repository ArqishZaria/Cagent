"""
Shared Telnyx webhook verification helper.

Telnyx signs every webhook with Ed25519 and sends the signature + timestamp in
headers. telnyx.Webhook.construct_event() verifies that signature against
TELNYX_WEBHOOK_SECRET and raises telnyx.error.SignatureVerificationError if it
doesn't match (or if the timestamp is outside the allowed tolerance window,
which guards against replay attacks). Every webhook view in this app must run
requests through this helper before touching the payload.
"""

import telnyx
from django.conf import settings
from rest_framework.exceptions import PermissionDenied


def verify_telnyx_webhook(request):
    """
    Verifies the raw request body against Telnyx's signature headers.

    Returns the parsed event (a telnyx.Event / dict-like object) on success.
    Raises rest_framework.exceptions.PermissionDenied (-> HTTP 403) on any
    verification failure, so an unsigned or forged request never reaches
    business logic.
    """
    payload = request.body
    sig_header = request.headers.get("Telnyx-Signature-Ed25519")
    timestamp_header = request.headers.get("Telnyx-Timestamp")

    if not sig_header or not timestamp_header:
        raise PermissionDenied("Missing Telnyx signature headers.")

    try:
        event = telnyx.Webhook.construct_event(
            payload,
            sig_header,
            timestamp_header,
            settings.TELNYX_WEBHOOK_SECRET,
        )
    except telnyx.error.SignatureVerificationError as exc:
        import logging
        logging.getLogger(__name__).error("Telnyx signature verification failed: %s", exc)
        raise PermissionDenied("Invalid Telnyx webhook signature.")
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception("Could not verify Telnyx webhook: %s", exc)
        raise PermissionDenied("Could not verify Telnyx webhook.")

    return event
