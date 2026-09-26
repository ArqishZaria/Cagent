from rest_framework import serializers

from core.models import CustomUser, Interaction, Lead


class LeadSerializer(serializers.ModelSerializer):
    last_message_at = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = (
            "id", "first_name", "last_name", "job_title", "company",
            "phone_number", "email", "website", "address", "city", "state",
            "status", "deal_value",
            "do_not_contact", "owner", "scrape_task", "contacted_at",
            "last_message_at",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "do_not_contact", "scrape_task", "contacted_at", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Restrict `owner` to users in the requesting user's own tenant, so a
        # Lead can never be assigned to an agent belonging to a different
        # tenant. Falls back to an empty queryset (rejects any value) if we
        # somehow have no request/tenant in context, rather than defaulting
        # to CustomUser.objects.all() (which would allow cross-tenant writes).
        request = self.context.get("request")
        if "owner" in self.fields:
            if request and getattr(request.user, "tenant_id", None):
                self.fields["owner"].queryset = CustomUser.objects.filter(tenant_id=request.user.tenant_id)
            else:
                self.fields["owner"].queryset = CustomUser.objects.none()

    def get_last_message_at(self, obj):
        # Populated as a plain attribute when the queryset annotates it
        # (see crm.views.LeadViewSet) — avoids an extra query per row.
        annotated = getattr(obj, "annotated_last_message_at", None)
        if annotated is not None:
            return annotated
        last = (
            obj.interactions.filter(type=Interaction.Type.SMS)
            .order_by("-timestamp")
            .values_list("timestamp", flat=True)
            .first()
        )
        return last or obj.contacted_at


class InteractionSerializer(serializers.ModelSerializer):
    lead_name = serializers.SerializerMethodField()
    phone_number_display = serializers.SerializerMethodField()

    class Meta:
        model = Interaction
        fields = (
            "id", "lead", "user", "type", "direction",
            "duration_seconds", "notes", "message_body", "missed", "timestamp",
            "lead_name", "phone_number_display",
        )
        read_only_fields = ("id", "missed", "timestamp", "lead_name", "phone_number_display")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Same reasoning as LeadSerializer.owner above: `lead` and `user`
        # must be restricted to the requesting user's own tenant, or a
        # client can attach a fabricated interaction to another tenant's
        # lead (it would still carry tenant=<attacker's tenant> on the
        # Interaction row itself, but would show up via lead.interactions
        # on the OTHER tenant's side — see crm.serializers.LeadSerializer.
        # get_last_message_at's cross-FK annotation in crm.views.LeadViewSet).
        request = self.context.get("request")
        tenant_id = getattr(request.user, "tenant_id", None) if request else None
        if "lead" in self.fields:
            self.fields["lead"].queryset = (
                Lead.objects.filter(tenant_id=tenant_id) if tenant_id else Lead.objects.none()
            )
        if "user" in self.fields:
            self.fields["user"].queryset = (
                CustomUser.objects.filter(tenant_id=tenant_id) if tenant_id else CustomUser.objects.none()
            )

    def get_lead_name(self, obj):
        if not obj.lead_id:
            return None
        name = f"{obj.lead.first_name} {obj.lead.last_name}".strip()
        return name or obj.lead.company or obj.lead.phone_number or "Unknown lead"

    def get_phone_number_display(self, obj):
        return obj.phone_number.phone_number if obj.phone_number_id else None