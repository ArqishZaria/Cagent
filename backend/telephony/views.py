import logging
from decimal import Decimal, InvalidOperation

import telnyx
from django.core.cache import cache
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Interaction, Lead, PhoneNumber
from core.permissions import IsTenantAdmin, IsTenantMember
from core.viewsets import TenantModelViewSet
from telephony.serializers import PhoneNumberSerializer
from telephony.services import (
    TelnyxAPIError,
    generate_webrtc_jwt,
    purchase_number,
    search_available_numbers,
    send_sms,
)
from telephony.webhook_utils import verify_telnyx_webhook

logger = logging.getLogger(__name__)

STOP_KEYWORDS = ("STOP", "UNSUBSCRIBE", "CANCEL")


def _field(obj, name):
    if obj is None:
        return None
    if isinstance(obj, dict):
        return obj.get(name)
    return getattr(obj, name, None)


def _sms_from_number(payload):
    frm = _field(payload, "from")
    return _field(frm, "phone_number")


def _sms_to_number(payload):
    to = _field(payload, "to")
    if isinstance(to, (list, tuple)) and to:
        return _field(to[0], "phone_number")
    return _field(to, "phone_number")


class WebRTCCredentialsView(APIView):
    permission_classes = [IsAuthenticated, IsTenantMember]

    def post(self, request):
        try:
            token = generate_webrtc_jwt(request.user)
        except TelnyxAPIError as exc:
            logger.exception("WebRTC credential generation failed")
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({"login_token": token})


class VoiceWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        event = verify_telnyx_webhook(request)

        data = _field(event, "data")
        event_type = _field(data, "event_type")
        payload = _field(data, "payload")
        call_control_id = _field(payload, "call_control_id")

        try:
            if event_type == "call.initiated":
                self._handle_call_initiated(payload, call_control_id)
            elif event_type == "call.hangup":
                self._handle_call_hangup(payload, call_control_id)
        except Exception:
            logger.exception("Error handling voice webhook event_type=%s", event_type)

        return Response(status=status.HTTP_200_OK)

    def _handle_call_initiated(self, payload, call_control_id):
        if _field(payload, "direction") != "incoming":
            return

        to_number = _field(payload, "to")
        from_number = _field(payload, "from")

        try:
            phone_number = PhoneNumber.objects.select_related("tenant", "assigned_user").get(
                phone_number=to_number, is_active=True
            )
        except PhoneNumber.DoesNotExist:
            logger.warning("Inbound call to unrecognized number %s", to_number)
            return

        tenant = phone_number.tenant
        assigned_user = phone_number.assigned_user

        lead, _created = Lead.objects.get_or_create(
            tenant=tenant,
            phone_number=from_number,
            defaults={"status": Lead.Status.NEW, "owner": assigned_user},
        )

        interaction = Interaction.objects.create(
            tenant=tenant,
            user=assigned_user,
            lead=lead,
            type=Interaction.Type.CALL,
            direction=Interaction.Direction.INBOUND,
            phone_number=phone_number,  # <-- added: attributes this log entry to the number that rang
        )
        cache.set(f"telnyx:call_interaction:{call_control_id}", interaction.id, timeout=3600)

        if assigned_user:
            self._route_to_agent(call_control_id, assigned_user)
        else:
            logger.info("Number %s has no assigned agent; call left unrouted.", to_number)

    def _route_to_agent(self, call_control_id, assigned_user):
        call = telnyx.Call()
        call.call_control_id = call_control_id
        call.transfer(to=f"sip:{assigned_user.username}@sip.telnyx.com")

    def _handle_call_hangup(self, payload, call_control_id):
        cache_key = f"telnyx:call_interaction:{call_control_id}"
        interaction_id = cache.get(cache_key)
        if not interaction_id:
            return

        duration = _field(payload, "call_duration_secs") or 0
        Interaction.objects.filter(id=interaction_id).update(duration_seconds=duration)
        cache.delete(cache_key)


class SMSSendView(APIView):
    permission_classes = [IsAuthenticated, IsTenantMember]

    def post(self, request):
        lead_id = request.data.get("lead_id")
        from_number = request.data.get("from_number")
        message = request.data.get("message")

        if not (lead_id and from_number and message):
            return Response(
                {"detail": "lead_id, from_number, and message are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lead = get_object_or_404(Lead, id=lead_id, tenant=request.user.tenant)

        if request.user.role == request.user.Role.AGENT and lead.owner_id not in (None, request.user.id):
            return Response({"detail": "This lead is not assigned to you."}, status=status.HTTP_403_FORBIDDEN)

        if lead.do_not_contact:
            return Response(
                {"detail": "This lead has opted out (STOP/UNSUBSCRIBE/CANCEL) and cannot be contacted."},
                status=status.HTTP_403_FORBIDDEN,
            )

        sender_number = get_object_or_404(
            PhoneNumber, phone_number=from_number, tenant=request.user.tenant, is_active=True
        )

        try:
            send_sms(sender_number.phone_number, lead.phone_number, message)
        except telnyx.error.TelnyxError as exc:
            logger.exception("Outbound SMS failed")
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        interaction = Interaction.objects.create(
            tenant=request.user.tenant,
            user=request.user,
            lead=lead,
            type=Interaction.Type.SMS,
            direction=Interaction.Direction.OUTBOUND,
            message_body=message,
            phone_number=sender_number,  # <-- added
        )

        return Response(
            {"id": interaction.id, "status": "sent"},
            status=status.HTTP_201_CREATED,
        )


class SMSWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        event = verify_telnyx_webhook(request)

        data = _field(event, "data")
        event_type = _field(data, "event_type")
        payload = _field(data, "payload")

        if event_type != "message.received":
            return Response(status=status.HTTP_200_OK)

        try:
            self._handle_inbound_sms(payload)
        except Exception:
            logger.exception("Error handling inbound SMS webhook")

        return Response(status=status.HTTP_200_OK)

    def _handle_inbound_sms(self, payload):
        from_number = _sms_from_number(payload)
        to_number = _sms_to_number(payload)
        text = _field(payload, "text") or ""

        try:
            phone_number = PhoneNumber.objects.select_related("tenant", "assigned_user").get(
                phone_number=to_number, is_active=True
            )
        except PhoneNumber.DoesNotExist:
            logger.warning("Inbound SMS to unrecognized number %s", to_number)
            return

        tenant = phone_number.tenant
        assigned_user = phone_number.assigned_user

        lead, _created = Lead.objects.get_or_create(
            tenant=tenant,
            phone_number=from_number,
            defaults={"status": Lead.Status.NEW, "owner": assigned_user},
        )

        if any(keyword in text.upper() for keyword in STOP_KEYWORDS):
            lead.do_not_contact = True
            lead.save(update_fields=["do_not_contact"])

        Interaction.objects.create(
            tenant=tenant,
            user=assigned_user,
            lead=lead,
            type=Interaction.Type.SMS,
            direction=Interaction.Direction.INBOUND,
            message_body=text,
            phone_number=phone_number,  # <-- added
        )


class NumberSearchView(APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        area_code = (request.query_params.get("area_code") or "").strip()
        if not area_code:
            return Response({"detail": "area_code is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            results = search_available_numbers(area_code)
        except TelnyxAPIError as exc:
            logger.exception("Number search failed")
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({"results": results})


class NumberPurchaseView(APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def post(self, request):
        phone_number = (request.data.get("phone_number") or "").strip()
        if not phone_number:
            return Response({"detail": "phone_number is required."}, status=status.HTTP_400_BAD_REQUEST)

        if PhoneNumber.objects.filter(phone_number=phone_number).exists():
            return Response({"detail": "This number has already been purchased."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = purchase_number(phone_number)
        except TelnyxAPIError as exc:
            logger.exception("Number purchase failed")
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        create_kwargs = {}
        raw_monthly_cost = request.data.get("monthly_cost")
        if raw_monthly_cost:
            try:
                create_kwargs["monthly_cost"] = Decimal(str(raw_monthly_cost))
            except InvalidOperation:
                return Response({"detail": "monthly_cost must be a valid decimal."}, status=status.HTTP_400_BAD_REQUEST)

        number = PhoneNumber.objects.create(
            tenant=request.user.tenant,
            phone_number=phone_number,
            telnyx_order_id=order.get("id", ""),
            is_active=True,
            **create_kwargs,
        )

        return Response(PhoneNumberSerializer(number).data, status=status.HTTP_201_CREATED)


class NumberViewSet(TenantModelViewSet):
    serializer_class = PhoneNumberSerializer
    queryset = PhoneNumber.objects.all().order_by("-purchased_at")
    agent_owner_field = None

    def get_permissions(self):
        if self.request.method in ("POST", "PUT", "PATCH", "DELETE"):
            return [IsAuthenticated(), IsTenantAdmin()]
        return [IsAuthenticated(), IsTenantMember()]