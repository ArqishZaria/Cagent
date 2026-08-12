from rest_framework import serializers

from core.models import PhoneNumber


class PhoneNumberSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhoneNumber
        fields = (
            "id", "phone_number", "assigned_user", "telnyx_order_id",
            "is_active", "monthly_cost", "purchased_at",
        )
        read_only_fields = ("id", "telnyx_order_id", "monthly_cost", "purchased_at")
