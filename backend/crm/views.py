from core.models import Interaction, Lead
from core.viewsets import TenantModelViewSet
from crm.serializers import InteractionSerializer, LeadSerializer
from rest_framework.exceptions import ValidationError

class LeadViewSet(TenantModelViewSet):
    """
    /api/leads/

    Supports optional query-param filtering used by the frontend:
      ?scrape_task=<id>  — leads produced by one Agentic Prospector search
      ?status=<STATUS>
      ?owner=<user_id>
    """

    serializer_class = LeadSerializer
    queryset = Lead.objects.all().order_by("-created_at")
    agent_owner_field = "owner"  # AGENT only sees their own leads (Day 2 pattern)

    def perform_create(self, serializer):
        tenant = self.request.user.tenant
        email = (serializer.validated_data.get("email") or "").strip()
        phone = (serializer.validated_data.get("phone_number") or "").strip()
        if email and Lead.objects.filter(tenant=tenant, email__iexact=email).exists():
            raise ValidationError({"email": "A lead with this email already exists."})
        if phone and Lead.objects.filter(tenant=tenant, phone_number=phone).exists():
            raise ValidationError({"phone_number": "A lead with this phone number already exists."})
        super().perform_create(serializer)
        
    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("scrape_task"):
            qs = qs.filter(scrape_task_id=params["scrape_task"])
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("owner"):
            qs = qs.filter(owner_id=params["owner"])
        return qs


class InteractionViewSet(TenantModelViewSet):
    """
    /api/interactions/

    Supports ?lead=<id>&type=SMS (used by the CRM's SMS thread) and
    ?lead=<id>&type=CALL (call history / notes).

    Unlike the other TenantModelViewSet subclasses, this one also defaults
    `user` to the requester when the client doesn't supply one — e.g. the
    dialer's "save call note" flow POSTs {lead, type, direction, notes}
    with no user field at all.
    """

    serializer_class = InteractionSerializer
    queryset = Interaction.objects.all().order_by("timestamp")
    agent_owner_field = "user"

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("lead"):
            qs = qs.filter(lead_id=params["lead"])
        if params.get("type"):
            qs = qs.filter(type=params["type"])
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        serializer.validated_data.pop("tenant", None)
        serializer.validated_data.pop("tenant_id", None)
        # Default to the requesting user if the client didn't specify one
        # (e.g. the dialer's call-note save doesn't send a `user` field).
        assigned_user = serializer.validated_data.get("user") or user
        serializer.save(tenant=user.tenant, user=assigned_user)
