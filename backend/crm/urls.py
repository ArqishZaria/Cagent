from rest_framework import serializers

from core.models import Interaction, Lead


class LeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = (
            "id", "first_name", "last_name", "job_title", "company",
            "phone_number", "email", "website", "address", "city", "state",
            "status", "deal_value",
            "do_not_contact", "owner", "scrape_task", "created_at", "updated_at",
        )
        read_only_fields = ("id", "do_not_contact", "scrape_task", "created_at", "updated_at")


class InteractionSerializer(serializers.ModelSerializer):
    # Read-only conveniences for the Call Logs page — avoids the frontend
    # needing a second round-trip to resolve lead/number names.
    lead_name = serializers.SerializerMethodField()
    lead_phone_number = serializers.CharField(source="lead.phone_number", read_only=True)
    phone_number_display = serializers.CharField(source="phone_number.phone_number", read_only=True)
    user_name = serializers.CharField(source="user.username", read_only=True, default="")

    class Meta:
        model = Interaction
        fields = (
            "id", "lead", "lead_name", "lead_phone_number",
            "user", "user_name",
            "type", "direction",
            "phone_number", "phone_number_display",
            "duration_seconds", "notes", "message_body", "timestamp",
        )
        read_only_fields = ("id", "timestamp")

    def get_lead_name(self, obj):
        if not obj.lead_id:
            return ""
        name = f"{obj.lead.first_name} {obj.lead.last_name}".strip()
        return name or obj.lead.company or obj.lead.phone_number