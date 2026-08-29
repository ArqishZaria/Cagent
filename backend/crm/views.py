from django.db.models import Q
from rest_framework.exceptions import ValidationError

from core.models import Interaction, Lead
from core.viewsets import TenantModelViewSet
from crm.serializers import InteractionSerializer, LeadSerializer


class LeadViewSet(TenantModelViewSet):
    """
    /api/leads/

    Supports optional query-param filtering used by the frontend:
      ?scrape_task=<id>  — leads produced by one Agentic Prospector search
      ?status=<STATUS>
      ?owner=<user_id>
      ?search=<text>     — matches company, city, state, name, email, or phone
                           (used by the standing Leads page's search box)

    Ownership rule (per TenantModelViewSet + agent_owner_field below):
    an AGENT only ever sees leads where owner == themselves — their own
    personal list. An ADMIN sees every lead in the tenant — the combined
    team-wide list.
    """

    serializer_class = LeadSerializer
    queryset = Lead.objects.all().order_by("-created_at")
    agent_owner_field = "owner"  # AGENT only sees their own leads (Day 2 pattern)

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("scrape_task"):
            qs = qs.filter(scrape_task_id=params["scrape_task"])
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("owner"):
            qs = qs.filter(owner_id=params["owner"])
        if params.get("search"):
            search_filter = Q()
            for term in params["search"].split():
                search_filter |= (
                    Q(company__icontains=term)
                    | Q(city__icontains=term)
                    | Q(state__icontains=term)
                    | Q(first_name__icontains=term)
                    | Q(last_name__icontains=term)
                    | Q(email__icontains=term)
                    | Q(phone_number__icontains=term)
                )
            qs = qs.filter(search_filter)
        return qs

    def perform_create(self, serializer):
        tenant = self.request.user.tenant
        email = (serializer.validated_data.get("email") or "").strip()
        phone = (serializer.validated_data.get("phone_number") or "").strip()
        if email and Lead.objects.filter(tenant=tenant, email__iexact=email).exists():
            raise ValidationError({"email": "A lead with this email already exists."})
        if phone and Lead.objects.filter(tenant=tenant, phone_number=phone).exists():
            raise ValidationError({"phone_number": "A lead with this phone number already exists."})
        super().perform_create(serializer)


class InteractionViewSet(TenantModelViewSet):
    """
    /api/interactions/

    Supports ?lead=<id>&type=SMS (used by the CRM's SMS thread), ?type=CALL
    (call history / Call Logs page), and ?phone_number=<id> — the last one
    lets an ADMIN filter call logs down to a single owned number; an AGENT
    is already scoped to their own interactions via agent_owner_field, so
    the number filter simply narrows that further.

    Unlike the other TenantModelViewSet subclasses, this one also defaults
    `user` to the requester when the client doesn't supply one — e.g. the
    dialer's "save call note" flow POSTs {lead, type, direction, notes}
    with no user field at all.
    """

    serializer_class = InteractionSerializer
    queryset = Interaction.objects.all().select_related("lead", "user", "phone_number").order_by("-timestamp")
    agent_owner_field = "user"

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("lead"):
            qs = qs.filter(lead_id=params["lead"])
        if params.get("type"):
            qs = qs.filter(type=params["type"])
        if params.get("phone_number"):
            qs = qs.filter(phone_number_id=params["phone_number"])
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        serializer.validated_data.pop("tenant", None)
        serializer.validated_data.pop("tenant_id", None)
        assigned_user = serializer.validated_data.get("user") or user
        instance = serializer.save(tenant=user.tenant, user=assigned_user)

        if instance.type == instance.Type.CALL and instance.duration_seconds:
            from wallet.services import bill_call
            bill_call(instance)