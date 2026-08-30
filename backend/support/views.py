from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
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
        return Response(SupportMessageSerializer(messages, many=True, context={"request": request}).data)


class SupportSendView(APIView):
    """
    POST /api/support/send/ — multipart form: {"message": "...", "attachment": <file>}

    Either message or attachment (or both) must be present — lets a tenant
    send just a screenshot with no caption, just text, or both together
    (e.g. a transfer proof with "sent from my SadaPay, please credit").
    """

    permission_classes = [IsAuthenticated, IsTenantAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        text = (request.data.get("message") or "").strip()
        file_obj = request.FILES.get("attachment")

        if not text and not file_obj:
            return Response({"detail": "message or attachment is required."}, status=status.HTTP_400_BAD_REQUEST)

        msg = SupportMessage.objects.create(
            tenant=request.user.tenant,
            sender=request.user,
            is_from_platform_owner=False,
            message=text,
            attachment=file_obj,
        )
        return Response(
            SupportMessageSerializer(msg, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class SupportAttachmentDownloadView(APIView):
    """
    GET /api/support/<id>/attachment/ — streams the uploaded proof file.
    Tenant-scoped: only an ADMIN belonging to the same tenant as the
    message can fetch it, matching the boss-only nature of this chat.
    """

    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request, pk):
        msg = get_object_or_404(SupportMessage, pk=pk, tenant=request.user.tenant)
        if not msg.attachment:
            raise Http404("No attachment on this message.")
        filename = msg.attachment.name.split("/")[-1]
        return FileResponse(msg.attachment.open("rb"), as_attachment=False, filename=filename)