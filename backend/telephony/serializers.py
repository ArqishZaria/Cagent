from rest_framework import serializers

from core.models import CustomUser, PhoneNumber


class PhoneNumberSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhoneNumber
        fields = (
            "id", "phone_number", "assigned_user", "telnyx_order_id",
            "is_active", "monthly_cost", "purchased_at",
        )
        read_only_fields = ("id", "phone_number", "is_active", "telnyx_order_id", "monthly_cost", "purchased_at")
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # assigned_user must be scoped to the requesting user's tenant —
        # this endpoint is ADMIN-only for writes (see telephony.views.
        # NumberViewSet.get_permissions), but an unscoped queryset would
        # still let an admin assign a number to a user in a different
        # tenant if they knew/guessed that user's id.
        request = self.context.get("request")
        tenant_id = getattr(request.user, "tenant_id", None) if request else None
        if "assigned_user" in self.fields:
            self.fields["assigned_user"].queryset = (
                CustomUser.objects.filter(tenant_id=tenant_id) if tenant_id else CustomUser.objects.none()
            )