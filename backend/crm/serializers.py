from rest_framework import serializers

from core.models import Interaction, Lead


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

    def get_lead_name(self, obj):
        if not obj.lead_id:
            return None
        name = f"{obj.lead.first_name} {obj.lead.last_name}".strip()
        return name or obj.lead.company or obj.lead.phone_number or "Unknown lead"

    def get_phone_number_display(self, obj):
        return obj.phone_number.phone_number if obj.phone_number_id else None