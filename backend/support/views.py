from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import SupportMessage
from core.permissions import IsTenantAdmin
from support.serializers import SupportMessageSerializer

# Per Part 2G of the spec: "Boss-Only Support Chat... Limited to ADMIN role."
# This is deliberate — only the boss handles billing/support, so both
# endpoints require IsTenantAdmin, not just IsTenantMember. One consequence
# worth knowing: when a PAID_OVERDUE tenant hits the frontend's
# PaymentOverdueOverlay, an AGENT viewing that lockout screen can see the
# embedded chat but their messages will 403 — only the tenant's ADMIN can
# actually use it, matching the spec as written.


class SupportHistoryView(APIView):
    """GET /api/support/history/ — full thread for the requester's tenant."""

    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        messages = SupportMessage.objects.filter(tenant=request.user.tenant).order_by("timestamp")
        return Response(SupportMessageSerializer(messages, many=True).data)


class SupportSendView(APIView):
    """POST /api/support/send/ — body: {"message": "..."}"""

    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def post(self, request):
        text = (request.data.get("message") or "").strip()
        if not text:
            return Response({"detail": "message is required."}, status=status.HTTP_400_BAD_REQUEST)

        msg = SupportMessage.objects.create(
            tenant=request.user.tenant,
            sender=request.user,
            is_from_platform_owner=False,
            message=text,
        )
        return Response(SupportMessageSerializer(msg).data, status=status.HTTP_201_CREATED)
