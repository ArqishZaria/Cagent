from rest_framework import serializers

from core.models import SupportMessage


class SupportMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportMessage
        fields = ("id", "sender", "is_from_platform_owner", "message", "timestamp")
        read_only_fields = ("id", "sender", "is_from_platform_owner", "timestamp")
