import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def send_password_reset_email(user, uid, token):
    reset_url = f"{settings.FRONTEND_BASE_URL}/reset-password?uid={uid}&token={token}"
    send_mail(
        subject="Reset your Cagent password",
        message=(
            f"Hi {user.first_name or user.username},\n\n"
            "Click the link below to set a new password. This link expires after a few "
            "days or as soon as it's used, whichever comes first.\n\n"
            f"{reset_url}\n\n"
            "If you didn't request this, you can safely ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True,
    )