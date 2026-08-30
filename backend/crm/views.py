from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from core.phone_utils import normalize_to_e164
from core.models import Interaction, Lead
from core.viewsets import TenantModelViewSet
from crm.serializers import InteractionSerializer, LeadSerializer


class LeadViewSet(TenantModelViewSet):
    serializer_class = LeadSerializer
    queryset = Lead.objects.all().order_by("-created_at")
    agent_owner_field = "owner"

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("scrape_task"):
            qs = qs.filter(scrape_task_id=params["scrape_task"])
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("owner"):
            qs = qs.filter(owner_id=params["owner"])
        if params.get("contacted") == "true":
            qs = qs.filter(contacted_at__isnull=False)
        elif params.get("contacted") == "false":
            qs = qs.filter(contacted_at__isnull=True)
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
        phone = normalize_to_e164((serializer.validated_data.get("phone_number") or "").strip())
        if email and Lead.objects.filter(tenant=tenant, email__iexact=email).exists():
            raise ValidationError({"email": "A lead with this email already exists."})
        if phone and Lead.objects.filter(tenant=tenant, phone_number=phone).exists():
            raise ValidationError({"phone_number": "A lead with this phone number already exists."})
        super().perform_create(serializer)

    @action(detail=True, methods=["post"])
    def contact(self, request, pk=None):
        """
        POST /api/leads/<id>/contact/ — the only thing that moves a lead
        into the CRM/Dialer tab. Idempotent.
        """
        lead = self.get_object()
        if lead.do_not_contact:
            return Response({"detail": "This lead has opted out and cannot be contacted."}, status=403)
        if not lead.contacted_at:
            lead.contacted_at = timezone.now()
            lead.save(update_fields=["contacted_at"])
        return Response(LeadSerializer(lead).data)


class InteractionViewSet(TenantModelViewSet):
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

        # Belt-and-suspenders: if a call/text got logged for a lead that
        # was never explicitly "Contacted" from the Leads List, mark it now
        # so it still shows up in the CRM tab.
        if instance.lead_id and not instance.lead.contacted_at:
            Lead.objects.filter(id=instance.lead_id, contacted_at__isnull=True).update(
                contacted_at=timezone.now()
            )

        if instance.type == instance.Type.CALL and instance.duration_seconds:
            from wallet.services import bill_call
            bill_call(instance)