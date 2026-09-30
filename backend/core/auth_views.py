"""
Hardened wrappers around SimpleJWT's token views.

Two problems fixed here, both affecting POST /api/auth/token/ and
/api/auth/token/refresh/:

1. No rate limiting — these were the only auth-adjacent endpoints in the
   app with no throttle at all, unlike password-reset and contact-form,
   which already use django_ratelimit.

2. A stale/expired access token left in the browser's localStorage gets
   auto-attached by frontend/src/lib/api.js's request interceptor to
   EVERY call it makes -- including a fresh login attempt. DRF runs
   authentication before permission checks, so JWTAuthentication rejects
   that stale token with 401 before the view's own AllowAny permission or
   the submitted username/password are ever looked at -- masking correct
   credentials as a login failure. Setting authentication_classes = []
   is the exact same fix already applied to
   users.views.PasswordResetRequestView / PasswordResetConfirmView and
   core.contact_views.ContactSubmitView, for the identical reason.
"""

import logging

from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)


@method_decorator(ratelimit(key="ip", rate="10/m", method="POST", block=False), name="post")
class ThrottledTokenObtainPairView(TokenObtainPairView):
    """POST /api/auth/token/ — login. Rate-limited per IP."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        if getattr(request, "limited", False):
            return Response(
                {"detail": "Too many login attempts — please wait a minute and try again."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        return super().post(request, *args, **kwargs)


@method_decorator(ratelimit(key="ip", rate="30/m", method="POST", block=False), name="post")
class ThrottledTokenRefreshView(TokenRefreshView):
    """
    POST /api/auth/token/refresh/ — same stale-header fix as above.
    Looser rate than login: this endpoint isn't currently called by the
    frontend at all yet (a separate, already-flagged gap), but a future
    fix for that will call it automatically in the background, not from a
    human typing a password, so it needs more headroom.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        if getattr(request, "limited", False):
            return Response(
                {"detail": "Too many requests — please try again shortly."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        return super().post(request, *args, **kwargs)
    
    
    
@method_decorator(ratelimit(key="ip", rate="30/m", method="POST", block=False), name="post")
class LogoutView(APIView):
    """
    POST /api/auth/logout/  Body: {"refresh": "<refresh token>"}

    Blacklists the refresh token server-side so it can never mint another
    access token, even if it was copied before logout. Idempotent: an
    already-expired, already-blacklisted, or malformed token still returns
    success (the client is logging out either way). Same
    authentication_classes = [] reasoning as the other auth views.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        if getattr(request, "limited", False):
            return Response(
                {"detail": "Too many requests — please try again shortly."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        refresh = request.data.get("refresh")
        if isinstance(refresh, str) and refresh:
            try:
                RefreshToken(refresh).blacklist()
            except TokenError:
                pass  # expired / already blacklisted / invalid — nothing left to revoke

        return Response({"detail": "Logged out."})