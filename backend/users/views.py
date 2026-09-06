from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import CustomUser
from core.permissions import IsTenantAdmin, IsTenantMember
from users.notifications import send_password_reset_email
from users.serializers import (
    AgentCreateSerializer, ChangePasswordSerializer, CurrentUserSerializer,
    PasswordResetConfirmSerializer, PasswordResetRequestSerializer, UserSummarySerializer,
)


class MeView(APIView):
    """
    GET /api/users/me/  — the current user's own profile.
    PATCH /api/users/me/ — update first_name/last_name/email only; username,
    role, and tenant are never editable through this endpoint.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(CurrentUserSerializer(request.user).data)

    def patch(self, request):
        serializer = CurrentUserSerializer(
            request.user, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CurrentUserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password updated."})


@method_decorator(ratelimit(key="ip", rate="5/h", method="POST", block=False), name="post")
class PasswordResetRequestView(APIView):
    """
    POST /api/users/password-reset/  Body: {"email": "..."}

    Public — no auth. Always returns the same generic response regardless
    of whether the email is registered, so this endpoint can't be used to
    enumerate accounts. Rate-limited per IP to deter abuse.

    authentication_classes is explicitly emptied (not just permission_classes
    = AllowAny) because DRF runs authentication before permissions — if the
    caller's browser has a stale/expired JWT sitting in localStorage (the
    frontend's shared `api` instance auto-attaches it to every request),
    JWTAuthentication would 401 this endpoint before AllowAny is ever
    consulted. Same fix already used by VoiceWebhookView/SMSWebhookView/
    GatewayWebhookView.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    GENERIC_RESPONSE = {"detail": "If an account exists for that email, a reset link is on its way."}

    def post(self, request):
        if getattr(request, "limited", False):
            return Response(
                {"detail": "Too many attempts — please try again later."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip()

        user = (
            CustomUser.objects.filter(email__iexact=email, is_active=True)
            .exclude(email="")
            .first()
        )
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = PasswordResetTokenGenerator().make_token(user)
            send_password_reset_email(user, uid, token)

        return Response(self.GENERIC_RESPONSE)


@method_decorator(ratelimit(key="ip", rate="10/h", method="POST", block=False), name="post")
class PasswordResetConfirmView(APIView):
    """
    POST /api/users/password-reset/confirm/
    Body: {"uid": "...", "token": "...", "new_password": "..."}

    Public — no auth (the token itself is the credential). Same
    authentication_classes = [] reasoning as PasswordResetRequestView above.
    Rate-limited too, since a guessable-in-theory uid/token pair costs
    nothing to hit repeatedly over POST.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        if getattr(request, "limited", False):
            return Response(
                {"detail": "Too many attempts — please try again later."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password updated. You can now sign in."})


class UserListView(APIView):
    """
    GET /api/users/

    Any authenticated tenant member can list their tenant's users — needed
    by Company Settings' "assign this number to an agent" dropdown. Returns
    only summary fields (no password hash, no email even — keep it minimal
    for a dropdown; use /api/users/manage/ or the admin panel for full detail).
    """

    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request):
        users = CustomUser.objects.filter(tenant=request.user.tenant).order_by("username")
        return Response(UserSummarySerializer(users, many=True).data)


class ManageUserView(APIView):
    """
    POST /api/users/manage/

    Creates a new AGENT account inside the requesting ADMIN's tenant.
    - Requires authentication AND role=ADMIN (IsTenantAdmin) -> AGENT callers
      get a 403 Forbidden, per spec.
    - tenant and role are never taken from the request body; the serializer
      fixes tenant=request.user.tenant and role=AGENT server-side.
    """

    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def post(self, request):
        serializer = AgentCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            AgentCreateSerializer(user, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )