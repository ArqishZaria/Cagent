from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import CustomUser
from core.permissions import IsTenantAdmin, IsTenantMember
from users.serializers import AgentCreateSerializer, UserSummarySerializer
from users.serializers import (
    AgentCreateSerializer, ChangePasswordSerializer, CurrentUserSerializer, UserSummarySerializer,
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
