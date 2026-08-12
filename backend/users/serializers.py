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
