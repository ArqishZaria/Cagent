from rest_framework import serializers

from core.models import SupportMessage


class SupportMessageSerializer(serializers.ModelSerializer):
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = SupportMessage
        fields = ("id", "sender", "is_from_platform_owner", "message", "attachment_url", "timestamp")
        read_only_fields = ("id", "sender", "is_from_platform_owner", "attachment_url", "timestamp")

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get("request")
        path = f"/api/support/{obj.id}/attachment/"
        return request.build_absolute_uri(path) if request else path