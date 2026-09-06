"""
Public marketing-site contact form. No auth, no tenant — this is the
pre-signup "get in touch" endpoint at /contact.
"""

import logging

from django.conf import settings
from django.core.mail import EmailMessage
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 5000


@method_decorator(ratelimit(key="ip", rate="5/h", method="POST", block=False), name="post")
class ContactSubmitView(APIView):
    """
    POST /api/contact/
    Body: {"name": "...", "email": "...", "company": "...", "message": "..."}

    Validates the submission and emails PLATFORM_OWNER_NOTIFICATION_EMAILS
    (the same list wallet.notifications uses) with reply-to set to the
    submitter's email so you can just hit "reply" in your inbox. Rate
    limited per IP since this endpoint has no auth.

    authentication_classes is explicitly emptied so a stale/expired JWT
    sitting in localStorage (auto-attached by the frontend's shared `api`
    instance) can never 401 this public endpoint — see PasswordResetRequestView
    for the full explanation of why permission_classes = [AllowAny] alone
    isn't enough.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        if getattr(request, "limited", False):
            return Response(
                {"detail": "Too many submissions — please try again later."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        name = (request.data.get("name") or "").strip()
        email = (request.data.get("email") or "").strip()
        company = (request.data.get("company") or "").strip()
        message = (request.data.get("message") or "").strip()

        if not name or not email or not message:
            return Response(
                {"detail": "name, email, and message are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(message) > MAX_MESSAGE_LENGTH:
            return Response({"detail": "Message is too long."}, status=status.HTTP_400_BAD_REQUEST)

        recipients = settings.PLATFORM_OWNER_NOTIFICATION_EMAILS
        if recipients:
            try:
                EmailMessage(
                    subject=f"New contact form submission — {company or name}",
                    body=(
                        f"Name: {name}\nEmail: {email}\nCompany: {company or '—'}\n\n"
                        f"Message:\n{message}"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=recipients,
                    reply_to=[email],
                ).send(fail_silently=True)
            except Exception:
                logger.exception("Failed to send contact form email")
        else:
            logger.warning("Contact form submitted but PLATFORM_OWNER_NOTIFICATION_EMAILS is empty")

        return Response(
            {"detail": "Thanks — we'll be in touch within one business day."},
            status=status.HTTP_201_CREATED,
        )