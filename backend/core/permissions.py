from django.db import IntegrityError, transaction
from django.db.models import F, Max, Q
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import CustomUser, Interaction, Lead
from core.permissions import IsTenantAdmin
from core.phone_utils import normalize_to_e164
from core.viewsets import TenantModelViewSet
from crm.serializers import InteractionSerializer, LeadSerializer


class LeadViewSet(TenantModelViewSet):
    serializer_class = LeadSerializer
    queryset = Lead.objects.all().order_by("-created_at")
    agent_owner_field = "owner"

    def get_permissions(self):
        # Deleting a lead cascades to every call/SMS record for it, so it is
        # admin-only. Agents can still create and edit their own leads.
        if self.action == "destroy":
            return [IsAuthenticated(), IsTenantAdmin()]
        return super().get_permissions()

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
            qs = qs.filter(contacted_at__isnull=False).annotate(
                annotated_last_message_at=Max(
                    "interactions__timestamp",
                    filter=Q(interactions__type=Interaction.Type.SMS),
                )
            ).order_by(F("annotated_last_message_at").desc(nulls_last=True), "-contacted_at")
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

    def _enforce_agent_owner_restriction(self, serializer):
        """
        An AGENT may only ever set `owner` to themselves (or leave it
        unchanged) — never to a teammate, and never to null. Without this an
        agent could PATCH a lead they own and hand it to any teammate
        (silently losing their own access), or null it out entirely.
        ADMIN is unrestricted.
        """
        user = self.request.user
        if user.role != CustomUser.Role.AGENT:
            return
        if "owner" not in serializer.validated_data:
            return

        new_owner = serializer.validated_data.get("owner")
        if new_owner is None or new_owner.id != user.id:
            raise ValidationError({
                "owner": "As an agent, you can only assign leads to yourself — "
                         "ask an admin to reassign this lead to someone else.",
            })

    def perform_create(self, serializer):
        user = self.request.user
        tenant = user.tenant
        email = (serializer.validated_data.get("email") or "").strip()
        phone = normalize_to_e164((serializer.validated_data.get("phone_number") or "").strip())
        if email and Lead.objects.filter(tenant=tenant, email__iexact=email).exists():
            raise ValidationError({"email": "A lead with this email already exists."})
        if phone and Lead.objects.filter(tenant=tenant, phone_number=phone).exists():
            raise ValidationError({"phone_number": "A lead with this phone number already exists."})

        # An agent-created lead must belong to that agent; otherwise it would
        # vanish from their own (owner-scoped) queryset immediately.
        if user.role == CustomUser.Role.AGENT and "owner" not in serializer.validated_data:
            serializer.validated_data["owner"] = user

        self._enforce_agent_owner_restriction(serializer)

        # The .exists() checks above are a fast pre-check, not a lock: two
        # near-simultaneous requests can both pass, then hit the DB-level
        # UniqueConstraint as a raw IntegrityError (500). Catching it turns
        # the race into the same clean 400 a normal duplicate gets.
        try:
            with transaction.atomic():
                super().perform_create(serializer)
        except IntegrityError:
            raise ValidationError({
                "detail": "A lead with this email or phone number was just created — please refresh and try again.",
            })

    def perform_update(self, serializer):
        self._enforce_agent_owner_restriction(serializer)
        super().perform_update(serializer)

    @action(detail=True, methods=["post"])
    def contact(self, request, pk=None):
        lead = self.get_object()
        if lead.do_not_contact:
            return Response({"detail": "This lead has opted out and cannot be contacted."}, status=403)
        if not lead.contacted_at:
            lead.contacted_at = timezone.now()
            lead.save(update_fields=["contacted_at"])
        return Response(self.get_serializer(lead).data)


class InteractionViewSet(TenantModelViewSet):
    serializer_class = InteractionSerializer
    queryset = Interaction.objects.all().select_related("lead", "user", "phone_number").order_by("-timestamp")
    agent_owner_field = "user"

    # Call/SMS history is an audit trail: no PUT (full replace) and no DELETE.
    http_method_names = ["get", "post", "patch", "head", "options"]

    # After creation, only the free-text note may change. Type, direction,
    # duration, message body, lead, user and number are all immutable, which
    # closes the "create a CALL, then PATCH it into a fake inbound SMS" hole.
    EDITABLE_ON_UPDATE = {"notes"}

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

    def perform_update(self, serializer):
        illegal = set(serializer.validated_data) - self.EDITABLE_ON_UPDATE
        if illegal:
            raise ValidationError({
                field: "This field can't be changed after creation." for field in sorted(illegal)
            })
        super().perform_update(serializer)

    def perform_create(self, serializer):
        user = self.request.user
        serializer.validated_data.pop("tenant", None)
        serializer.validated_data.pop("tenant_id", None)

        # An AGENT may only log activity as themself; an ADMIN may attribute
        # an interaction to any teammate.
        requested_user = serializer.validated_data.get("user")
        if user.role == user.Role.AGENT and requested_user and requested_user.id != user.id:
            raise ValidationError({"user": "You can only log activity under your own account."})
        assigned_user = requested_user or user

        # Manual logging is for CALL notes only. Every real SMS is created
        # server-side (outbound via SMSSendView, inbound via the signed Telnyx
        # webhook). Allowing type=SMS here would let a client fabricate a
        # message that appears to come from the lead, with no signature and
        # no billing.
        if serializer.validated_data.get("type") == Interaction.Type.SMS:
            raise ValidationError({
                "detail": "SMS interactions can't be logged directly — they're created automatically when a "
                          "message is actually sent or received.",
            })

        instance = serializer.save(tenant=user.tenant, user=assigned_user)

        if instance.lead_id and not instance.lead.contacted_at:
            Lead.objects.filter(id=instance.lead_id, contacted_at__isnull=True).update(
                contacted_at=timezone.now()
            )

        # NOTE: CALL-type Interactions are never billed here. Every real call
        # is created AND billed exclusively from Telnyx's signed webhooks
        # (telephony.views.VoiceWebhookView), so a client can't trigger a
        # wallet charge via duration_seconds.