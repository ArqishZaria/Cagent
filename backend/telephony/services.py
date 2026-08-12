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
    GET /v2/available_phone_numbers — returns candidate US numbers starting
    with the given area code, along with Telnyx's monthly cost estimate so
    we can store it on PhoneNumber.monthly_cost at purchase time.
    """
    resp = requests.get(
        f"{TELNYX_API_BASE}/available_phone_numbers",
        headers=_telnyx_headers(),
        params={
            "filter[phone_number][starts_with]": f"+1{area_code}",
            "filter[limit]": limit,
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
    POST /v2/number_orders — orders the given number. Telnyx provisions it
    near-instantly for most US numbers; the order response includes the
    order id we store as PhoneNumber.telnyx_order_id.
    """
    resp = requests.post(
        f"{TELNYX_API_BASE}/number_orders",
        headers=_telnyx_headers(),
        json={"phone_numbers": [{"phone_number": phone_number}]},
        timeout=15,
    )
    if resp.status_code >= 400:
        raise TelnyxAPIError(f"Number purchase failed: {resp.status_code} {resp.text}")

    return resp.json()["data"]
