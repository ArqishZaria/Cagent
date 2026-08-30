from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from core.models import CustomUser


class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ("id", "username", "first_name", "last_name", "role")


class AgentCreateSerializer(serializers.ModelSerializer):
    """
    Used exclusively by ADMIN users (see users.views.ManageUserView) to create
    new AGENT accounts inside their own tenant. `role` and `tenant` are never
    accepted from the client — they're fixed server-side.
    """

    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = CustomUser
        fields = ("id", "username", "email", "first_name", "last_name", "password")
        read_only_fields = ("id",)

    def create(self, validated_data):
        password = validated_data.pop("password")
        tenant = self.context["request"].user.tenant

        user = CustomUser(
            tenant=tenant,
            role=CustomUser.Role.AGENT,  # hard-coded — this endpoint only ever creates agents
            **validated_data,
        )
        user.set_password(password)
        user.save()
        return user

class CurrentUserSerializer(serializers.ModelSerializer):
    """Used by /api/users/me/ — powers the Profile page and lets the
    frontend decide role-gated UI (e.g. showing Support Chat only to ADMIN)."""

    company_name = serializers.SerializerMethodField()
    subscription_status = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            "id", "username", "email", "first_name", "last_name", "role",
            "company_name", "subscription_status", "date_joined",
        )
        read_only_fields = ("id", "username", "role", "company_name", "subscription_status", "date_joined")

    def get_company_name(self, obj):
        return obj.tenant.company_name if obj.tenant_id else None

    def get_subscription_status(self, obj):
        return obj.tenant.subscription_status if obj.tenant_id else None


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user