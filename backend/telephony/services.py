"""
Thin wrappers around the Telnyx API for:
  - minting a short-lived WebRTC JWT for a browser dialer client
  - sending an outbound SMS

Uses the telnyx Python SDK where it has first-class support (SMS), and plain
`requests` against Telnyx's REST API for telephony credentials / on-demand
JWTs, since that flow is simplest to reason about across SDK versions.
"""

import requests
import telnyx
from django.conf import settings
from django.core.cache import cache

TELNYX_API_BASE = "https://api.telnyx.com/v2"

import logging

logger = logging.getLogger(__name__)

class TelnyxAPIError(Exception):
    pass


def _telnyx_headers():
    return {
        "Authorization": f"Bearer {settings.TELNYX_API_KEY}",
        "Content-Type": "application/json",
    }


def get_or_create_webrtc_credential(user):
    """
    Every WebRTC-enabled agent needs a Telnyx "telephony credential" attached
    to our SIP Connection (settings.TELNYX_CONNECTION_ID). We create one the
    first time a given user asks for WebRTC access and cache the resulting
    credential_id (keyed by user id) so we don't create a new one on every
    login.

    NOTE: cache.set here uses Django's configured cache backend. In a
    single-process dev setup the default LocMemCache is fine; in production
    with multiple workers, point CACHES at Redis (settings.REDIS_URL) so all
    workers see the same credential_id, or persist it on CustomUser instead.
    """
    cache_key = f"telnyx:webrtc_credential:{user.pk}"
    credential_id = cache.get(cache_key)
    if credential_id:
        return credential_id

    resp = requests.post(
        f"{TELNYX_API_BASE}/telephony_credentials",
        headers=_telnyx_headers(),
        json={
            "connection_id": settings.TELNYX_CONNECTION_ID,
            "name": f"agent-{user.pk}-{user.username}",
        },
        timeout=10,
    )
    if resp.status_code >= 400:
        raise TelnyxAPIError(f"Failed to create Telnyx credential: {resp.status_code} {resp.text}")

    credential_id = resp.json()["data"]["id"]
    # Credentials don't expire on their own; cache indefinitely (until evicted).
    cache.set(cache_key, credential_id, timeout=None)
    return credential_id


def generate_webrtc_jwt(user):
    """
    Mints a short-lived on-demand JWT for `user`'s Telnyx WebRTC credential.
    The React app hands this straight to @telnyx/react-client's
    TelnyxRTCProvider as the `login_token`.
    """
    credential_id = get_or_create_webrtc_credential(user)

    resp = requests.post(
        f"{TELNYX_API_BASE}/telephony_credentials/{credential_id}/token",
        headers=_telnyx_headers(),
        timeout=10,
    )
    if resp.status_code >= 400:
        raise TelnyxAPIError(f"Failed to mint WebRTC JWT: {resp.status_code} {resp.text}")

    # Telnyx returns the raw JWT string as the response body for this endpoint.
    return resp.text.strip().strip('"')


def send_sms(from_number: str, to_number: str, text: str):
    """Sends an outbound SMS via Telnyx. Raises telnyx.error.* on failure."""
    return telnyx.Message.create(
        from_=from_number,
        to=to_number,
        text=text,
    )


# --- Number search & purchase (Part 2D) ----------------------------------------------


def search_available_numbers(area_code: str, limit: int = 10) -> list[dict]:
    """
    GET /v2/available_phone_numbers — returns candidate US numbers in the
    given area code, along with Telnyx's monthly cost estimate so we can
    store it on PhoneNumber.monthly_cost at purchase time.
    """
    resp = requests.get(
        f"{TELNYX_API_BASE}/available_phone_numbers",
        headers=_telnyx_headers(),
        params={
            "filter[country_code]": "US",
            "filter[national_destination_code]": area_code,
            "filter[limit]": limit,
            "filter[best_effort]": "true",
        },
        timeout=10,
    )
    if resp.status_code >= 400:
        raise TelnyxAPIError(f"Number search failed: {resp.status_code} {resp.text}")

    results = []
    for item in resp.json().get("data", []):
        cost_info = item.get("cost_information") or {}
        results.append(
            {
                "phone_number": item.get("phone_number"),
                "region": item.get("region_information", [{}])[0].get("region_name", ""),
                "monthly_cost": cost_info.get("monthly_cost", "1.00"),
            }
        )
    return results


def purchase_number(phone_number: str) -> dict:
    """
    Orders the given number via Telnyx, then wires it up for both Voice
    (assigns it to our SIP Connection so calls route through the WebRTC
    dialer) and SMS (assigns it to our Messaging Profile so it's allowed to
    send/receive texts) — so a newly purchased number is immediately usable
    for both, without any manual portal steps per number.
    """
    resp = requests.post(
        f"{TELNYX_API_BASE}/number_orders",
        headers=_telnyx_headers(),
        json={
            "phone_numbers": [{"phone_number": phone_number}],
            "connection_id": settings.TELNYX_CONNECTION_ID,
        },
        timeout=15,
    )
    if resp.status_code >= 400:
        raise TelnyxAPIError(f"Number purchase failed: {resp.status_code} {resp.text}")

    order_data = resp.json()["data"]

    # Assign to the Messaging Profile for SMS. Non-fatal on failure — the
    # number is still usable for voice immediately either way, but we log
    # loudly so a failed SMS assignment doesn't go unnoticed.
    if settings.TELNYX_MESSAGING_PROFILE_ID:
        try:
            update_resp = requests.patch(
                f"{TELNYX_API_BASE}/messaging_phone_numbers/{phone_number}",
                headers=_telnyx_headers(),
                json={"messaging_profile_id": settings.TELNYX_MESSAGING_PROFILE_ID},
                timeout=10,
            )
            if update_resp.status_code >= 400:
                raise TelnyxAPIError(
                    f"Messaging profile assignment failed: {update_resp.status_code} {update_resp.text}"
                )
        except TelnyxAPIError:
            logger.exception(
                "Number %s purchased and voice-connected, but SMS assignment failed — "
                "assign it to a Messaging Profile manually in the Telnyx portal if needed.",
                phone_number,
            )

    return order_data