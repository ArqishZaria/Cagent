"""
Subscription lockout middleware.

If a tenant's subscription_status is PAID_OVERDUE, every API request is blocked
with HTTP 402 Payment Required — EXCEPT requests to the support endpoints, so
locked-out customers can still reach the boss-only support chat (e.g. to upload
a payment receipt) and requests that aren't authenticated yet (login, token
refresh) or aren't part of the API at all (Django admin).

Add this to MIDDLEWARE in settings.py, after AuthenticationMiddleware:

    MIDDLEWARE = [
        ...
        "django.contrib.auth.middleware.AuthenticationMiddleware",
        "core.middleware.IsSubscriptionActive",
        ...
    ]
"""

import json

from django.http import JsonResponse

# Path prefixes that remain reachable even when a tenant is PAID_OVERDUE.
WHITELISTED_PREFIXES = (
    "/api/support/",
    "/api/auth/",  # login / token refresh — needed to even reach the app
    "/admin/",  # Django admin stays open for the platform owner
)


class IsSubscriptionActive:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if self._is_whitelisted(request.path):
            return self.get_response(request)

        user = getattr(request, "user", None)

        # Unauthenticated requests (e.g. hitting a public endpoint) are left
        # alone here — normal DRF/Django auth handles rejecting those.
        if user is None or not user.is_authenticated:
            return self.get_response(request)

        tenant = getattr(user, "tenant", None)
        if tenant is not None and tenant.subscription_status == tenant.SubscriptionStatus.PAID_OVERDUE:
            return JsonResponse(
                {
                    "detail": "Payment required. Your subscription is overdue.",
                    "code": "subscription_overdue",
                    "support_url": "/api/support/",
                },
                status=402,
                content_type="application/json",
            )

        return self.get_response(request)

    @staticmethod
    def _is_whitelisted(path: str) -> bool:
        return any(path.startswith(prefix) for prefix in WHITELISTED_PREFIXES)
