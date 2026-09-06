from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
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


class PasswordResetRequestSerializer(serializers.Serializer):
    """POST body for /api/users/password-reset/ — just an email address."""
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """
    POST body for /api/users/password-reset/confirm/. uid/token come from
    the link in the reset email; validate() decodes the uid, loads the
    user, and checks the token before allowing save() to actually change
    the password.
    """
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate(self, attrs):
        try:
            user_id = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = CustomUser.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
            raise serializers.ValidationError({"detail": "This reset link is invalid."})

        if not PasswordResetTokenGenerator().check_token(user, attrs["token"]):
            raise serializers.ValidationError({"detail": "This reset link is invalid or has expired."})

        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user