from rest_framework import serializers

from core.models import Interaction, Lead


class LeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = (
            "id", "first_name", "last_name", "job_title", "company",
            "phone_number", "email", "website", "address", "city", "state",
            "status", "deal_value",
            "do_not_contact", "owner", "scrape_task", "contacted_at",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "do_not_contact", "scrape_task", "contacted_at", "created_at", "updated_at")

class InteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interaction
        fields = (
            "id", "lead", "user", "type", "direction",
            "duration_seconds", "notes", "message_body", "missed", "timestamp",
        )
        read_only_fields = ("id", "missed", "timestamp")