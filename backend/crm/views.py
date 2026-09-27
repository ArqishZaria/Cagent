from django.db import IntegrityError, transaction
from django.db.models import F, Max, Q
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

    def perform_create(self, serializer):
        tenant = self.request.user.tenant
        email = (serializer.validated_data.get("email") or "").strip()
        phone = normalize_to_e164((serializer.validated_data.get("phone_number") or "").strip())
        if email and Lead.objects.filter(tenant=tenant, email__iexact=email).exists():
            raise ValidationError({"email": "A lead with this email already exists."})
        if phone and Lead.objects.filter(tenant=tenant, phone_number=phone).exists():
            raise ValidationError({"phone_number": "A lead with this phone number already exists."})

        # The .exists() checks above are a fast pre-check, not a lock — two
        # near-simultaneous requests can both pass them, then both try to
        # insert, hitting Lead's DB-level UniqueConstraint
        # (unique_tenant_email_when_present / unique_tenant_phone_when_present)
        # as a raw, unhandled IntegrityError -> 500. Catching it here turns
        # the race into the same clean 400 a normal duplicate already gets.
        try:
            with transaction.atomic():
                super().perform_create(serializer)
        except IntegrityError:
            raise ValidationError({
                "detail": "A lead with this email or phone number was just created — please refresh and try again.",
            })
            
            
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

        # An AGENT may only ever log activity as themself — an ADMIN may
        # attribute an interaction to any teammate (e.g. logging a call that
        # actually happened on someone else's desk phone/notes on their
        # behalf). This mirrors the read-side visibility rule already
        # enforced by TenantModelViewSet.agent_owner_field for this same
        # model; previously the write side didn't enforce the equivalent
        # restriction, letting an AGENT attribute activity to a colleague.
        requested_user = serializer.validated_data.get("user")
        if user.role == user.Role.AGENT and requested_user and requested_user.id != user.id:
            raise ValidationError({"user": "You can only log activity under your own account."})
        assigned_user = requested_user or user

        # This endpoint is for manual/administrative logging ONLY — it must
        # never be a second way to "send" an SMS or bill a call. Every real
        # SMS goes through telephony.views.SMSSendView (which enforces
        # do_not_contact, lead ownership, platform-fee, and wallet balance
        # BEFORE actually calling Telnyx), and every real call is created
        # and billed exclusively by telephony.views.VoiceWebhookView from
        # Telnyx's own signed webhooks. Blocking outbound SMS creation here
        # entirely closes the loophole of a fabricated "sent" message with
        # none of those checks; inbound SMS/any CALL row can still be
        # logged manually (e.g. noting a call that happened on a physical
        # desk phone), since those aren't claims of an action THIS request
        # performed.
        if (
            serializer.validated_data.get("type") == Interaction.Type.SMS
            and serializer.validated_data.get("direction") == Interaction.Direction.OUTBOUND
        ):
            raise ValidationError({
                "detail": "Outbound SMS can't be logged directly — send it from the lead's chat instead.",
            })

        instance = serializer.save(tenant=user.tenant, user=assigned_user)

        if instance.lead_id and not instance.lead.contacted_at:
            Lead.objects.filter(id=instance.lead_id, contacted_at__isnull=True).update(
                contacted_at=timezone.now()
            )

        # NOTE: CALL-type Interactions are never billed here — every call
        # (inbound or outbound) is created AND billed exclusively from
        # Telnyx's own signed webhooks (telephony.views.VoiceWebhookView).
        # A client can still log a CALL-type Interaction here for manual
        # note-keeping, but it can no longer trigger a wallet charge no
        # matter what duration_seconds it sends.