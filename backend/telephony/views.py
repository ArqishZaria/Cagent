import logging

import telnyx
from django.core.cache import cache
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.master_lead import propagate_global_opt_out
from core.models import Interaction, Lead, PhoneNumber
from core.permissions import IsTenantAdmin, IsTenantMember
from core.phone_utils import normalize_to_e164
from core.viewsets import TenantModelViewSet
from telephony.serializers import PhoneNumberSerializer
from telephony.services import (
    TelnyxAPIError,
    generate_webrtc_jwt,
    get_agent_sip_username,
    purchase_number,
    release_number,
    search_available_numbers,
    send_sms,
)
from telephony.webhook_utils import verify_telnyx_webhook
from wallet.models import PricingRate, TenantWallet
from wallet.services import (
    InsufficientBalance,
    PlatformFeeOverdue,
    bill_call,
    bill_number_purchase,
    bill_sms,
    calculate_number_purchase_cost,
    count_sms_segments,
    require_balance,
    require_platform_fee_current,
)

logger = logging.getLogger(__name__)

STOP_KEYWORDS = ("STOP", "UNSUBSCRIBE", "CANCEL")


def _field(obj, name):
    if obj is None:
        return None
    if isinstance(obj, dict):
        return obj.get(name)
    return getattr(obj, name, None)


def _from_field(obj):
    """
    Telnyx SDK objects expose the sender field as `from_` (with a trailing
    underscore) because `from` is a reserved Python keyword. Plain dict
    payloads still use the literal key "from". Check both.
    """
    value = _field(obj, "from_")
    if value is None:
        value = _field(obj, "from")
    return value


def _sms_from_number(payload):
    frm = _from_field(payload)
    return normalize_to_e164(_field(frm, "phone_number"))


def _sms_to_number(payload):
    to = _field(payload, "to")
    if isinstance(to, (list, tuple)) and to:
        return normalize_to_e164(_field(to[0], "phone_number"))
    return normalize_to_e164(_field(to, "phone_number"))


def _mark_contacted_if_needed(lead):
    """
    An inbound call or text is itself a form of contact — the lead should
    appear in the CRM/Dialer chat list the moment they reach out.
    Idempotent: only writes if not already set.
    """
    if not lead.contacted_at:
        lead.contacted_at = timezone.now()
        lead.save(update_fields=["contacted_at"])


class WebRTCCredentialsView(APIView):
    """
    Gated on the recurring platform fee AND wallet balance: a tenant that is
    not ACTIVE, or has a $0 wallet, can't get a WebRTC login token, so the
    dialer never connects.

    IMPORTANT: this check happens once, at token-mint time. A token stays
    valid for the whole WebRTC session, so this alone does NOT stop a call
    placed later in that session after the balance has dropped to zero —
    _handle_outbound_call_initiated has its OWN independent gate, enforced
    from Telnyx's signed webhook. Treat this view's checks as fast-fail UX,
    not the security boundary.
    """

    permission_classes = [IsAuthenticated, IsTenantMember]

    def post(self, request):
        try:
            require_platform_fee_current(request.user.tenant)
        except PlatformFeeOverdue as exc:
            return Response(
                {
                    "detail": f"Platform fee (${exc.amount_due}) is overdue — top up to keep calling.",
                    "code": "platform_fee_overdue",
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        wallet, _ = TenantWallet.objects.get_or_create(tenant=request.user.tenant)
        if wallet.balance_usd <= 0:
            return Response(
                {"detail": "Wallet balance is $0 — top up to enable calling.", "code": "insufficient_balance"},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        try:
            token = generate_webrtc_jwt(request.user)
        except TelnyxAPIError as exc:
            logger.exception("WebRTC credential generation failed")
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({"login_token": token})


class CallEligibilityView(APIView):
    """
    POST /api/telephony/calls/check-balance/

    Called by the frontend right before dialing, purely for UX (a clear
    "top up to call" message instead of a call that rings then gets killed).
    NOT the security boundary: a modified client could skip it. The real
    enforcement is _handle_outbound_call_initiated, driven by Telnyx's own
    call.initiated webhook.
    """

    permission_classes = [IsAuthenticated, IsTenantMember]

    def post(self, request):
        try:
            require_platform_fee_current(request.user.tenant)
        except PlatformFeeOverdue as exc:
            return Response(
                {
                    "detail": f"Platform fee (${exc.amount_due}) is overdue — top up to keep calling.",
                    "code": "platform_fee_overdue",
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        per_minute = PricingRate.get_cost(PricingRate.Key.CALL_OUTBOUND_PER_MINUTE)
        try:
            require_balance(request.user.tenant, per_minute)
        except InsufficientBalance as exc:
            return Response(
                {
                    "detail": f"Insufficient wallet balance for a call (need ${exc.required}, have ${exc.available}).",
                    "code": "insufficient_balance",
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        return Response({"ok": True})


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
            elif event_type == "call.cost":
                self._handle_call_cost(payload, call_control_id)
        except Exception:
            logger.exception("Error handling voice webhook event_type=%s", event_type)

        return Response(status=status.HTTP_200_OK)

    def _handle_call_initiated(self, payload, call_control_id):
        direction = _field(payload, "direction")
        if direction == "incoming":
            self._handle_inbound_call_initiated(payload, call_control_id)
        elif direction == "outgoing":
            self._handle_outbound_call_initiated(payload, call_control_id)
        # Anything else: ignore.

    def _handle_inbound_call_initiated(self, payload, call_control_id):
        to_number = normalize_to_e164(_field(payload, "to"))
        from_number = normalize_to_e164(_from_field(payload))

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
        _mark_contacted_if_needed(lead)

        try:
            require_platform_fee_current(tenant)
        except PlatformFeeOverdue:
            logger.info(
                "Auto-declining inbound call to %s — tenant %s not active / fee overdue",
                to_number, tenant.company_name,
            )
            Interaction.objects.create(
                tenant=tenant, user=assigned_user, lead=lead,
                type=Interaction.Type.CALL, direction=Interaction.Direction.INBOUND,
                phone_number=phone_number, duration_seconds=0, missed=True,
                notes="Auto-declined — platform fee overdue or account inactive.",
            )
            self._decline_call(call_control_id)
            return

        per_minute = PricingRate.get_cost(PricingRate.Key.CALL_INBOUND_PER_MINUTE)
        try:
            require_balance(tenant, per_minute)
        except InsufficientBalance:
            logger.info(
                "Auto-declining inbound call to %s — insufficient balance for tenant %s",
                to_number, tenant.company_name,
            )
            Interaction.objects.create(
                tenant=tenant, user=assigned_user, lead=lead,
                type=Interaction.Type.CALL, direction=Interaction.Direction.INBOUND,
                phone_number=phone_number, duration_seconds=0, missed=True,
                notes="Auto-declined — insufficient wallet balance.",
            )
            self._decline_call(call_control_id)
            return

        interaction = Interaction.objects.create(
            tenant=tenant, user=assigned_user, lead=lead,
            type=Interaction.Type.CALL, direction=Interaction.Direction.INBOUND,
            phone_number=phone_number,
        )
        cache.set(f"telnyx:call_interaction:{call_control_id}", interaction.id, timeout=3600)

        if assigned_user:
            self._route_to_agent(call_control_id, assigned_user)
        else:
            logger.info("Number %s has no assigned agent; call left unrouted.", to_number)

    def _handle_outbound_call_initiated(self, payload, call_control_id):
        """
        Fires for every call placed from our WebRTC dialer
        (direction="outgoing"). This is the ONLY place an outbound
        Interaction row is created.

        SECURITY: carries its own platform-fee/balance gate. This is the real
        enforcement boundary for outbound calls — the REST pre-checks can be
        skipped by a modified client, this webhook cannot. If the tenant is
        over-drawn or inactive at that moment the call is hung up before it
        connects and logged as missed.

        KNOWN GAP (fixed in the next batch, C2): the tenant is derived from
        the caller-ID number, which a modified client can spoof.
        """
        cache_key = f"telnyx:call_interaction:{call_control_id}"
        if cache.get(cache_key):
            return  # duplicate call.initiated delivery — already handled

        from_number = normalize_to_e164(_from_field(payload))   # our own Telnyx number
        to_number = normalize_to_e164(_field(payload, "to"))    # the lead's number

        try:
            phone_number = PhoneNumber.objects.select_related("tenant", "assigned_user").get(
                phone_number=from_number, is_active=True
            )
        except PhoneNumber.DoesNotExist:
            logger.warning("Outbound call from unrecognized number %s — can't attribute for billing.", from_number)
            return

        tenant = phone_number.tenant
        assigned_user = phone_number.assigned_user

        lead, _created = Lead.objects.get_or_create(
            tenant=tenant,
            phone_number=to_number,
            defaults={"status": Lead.Status.NEW, "owner": assigned_user},
        )
        _mark_contacted_if_needed(lead)

        try:
            require_platform_fee_current(tenant)
        except PlatformFeeOverdue:
            logger.info(
                "Killing outbound call from %s — tenant %s not active / fee overdue",
                from_number, tenant.company_name,
            )
            Interaction.objects.create(
                tenant=tenant, user=assigned_user, lead=lead,
                type=Interaction.Type.CALL, direction=Interaction.Direction.OUTBOUND,
                phone_number=phone_number, duration_seconds=0, missed=True,
                notes="Auto-terminated — platform fee overdue or account inactive.",
            )
            self._decline_call(call_control_id)
            return

        per_minute = PricingRate.get_cost(PricingRate.Key.CALL_OUTBOUND_PER_MINUTE)
        try:
            require_balance(tenant, per_minute)
        except InsufficientBalance:
            logger.info(
                "Killing outbound call from %s — insufficient balance for tenant %s",
                from_number, tenant.company_name,
            )
            Interaction.objects.create(
                tenant=tenant, user=assigned_user, lead=lead,
                type=Interaction.Type.CALL, direction=Interaction.Direction.OUTBOUND,
                phone_number=phone_number, duration_seconds=0, missed=True,
                notes="Auto-terminated — insufficient wallet balance.",
            )
            self._decline_call(call_control_id)
            return

        interaction = Interaction.objects.create(
            tenant=tenant,
            user=assigned_user,
            lead=lead,
            type=Interaction.Type.CALL,
            direction=Interaction.Direction.OUTBOUND,
            phone_number=phone_number,
        )
        cache.set(cache_key, interaction.id, timeout=3600)

    def _route_to_agent(self, call_control_id, assigned_user):
        sip_username = get_agent_sip_username(assigned_user)
        call = telnyx.Call()
        call.call_control_id = call_control_id
        call.transfer(to=f"sip:{sip_username}@sip.telnyx.com")

    def _decline_call(self, call_control_id):
        call = telnyx.Call()
        call.call_control_id = call_control_id
        call.hangup()

    def _handle_call_hangup(self, payload, call_control_id):
        """
        Telnyx's call.hangup payload for this account carries no duration
        field, so billing happens entirely in _handle_call_cost using
        call.cost's billed_duration_secs. Intentionally a no-op.
        """
        return

    def _handle_call_cost(self, payload, call_control_id):
        """
        call.cost is Telnyx's final, authoritative billing event for a call
        leg and carries billed_duration_secs. This is the ONLY code path that
        calls bill_call().

        KNOWN GAP (fixed in the next batch, C3): the call_control_id ->
        interaction mapping lives in Redis with a 1-hour TTL, so a call
        longer than an hour, or a Redis flush, would go unbilled.
        """
        cache_key = f"telnyx:call_interaction:{call_control_id}"
        interaction_id = cache.get(cache_key)
        if not interaction_id:
            return  # already processed, or call.initiated was never handled for this leg

        cache.delete(cache_key)

        duration = _field(payload, "billed_duration_secs") or 0
        Interaction.objects.filter(id=interaction_id).update(duration_seconds=duration)

        if duration:
            interaction = Interaction.objects.select_related("tenant", "phone_number").get(id=interaction_id)
            bill_call(interaction)


class SMSSendView(APIView):
    """
    Checks the platform fee and wallet balance BEFORE sending (so we never
    pay Telnyx for a message we then can't bill for), then bills the actual
    segment count after a successful send.
    """

    permission_classes = [IsAuthenticated, IsTenantMember]

    def post(self, request):
        lead_id = request.data.get("lead_id")
        from_number = normalize_to_e164((request.data.get("from_number") or "").strip())
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

        try:
            require_platform_fee_current(request.user.tenant)
        except PlatformFeeOverdue as exc:
            return Response(
                {
                    "detail": f"Platform fee (${exc.amount_due}) is overdue — top up to keep texting.",
                    "code": "platform_fee_overdue",
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        sender_number = get_object_or_404(
            PhoneNumber, phone_number=from_number, tenant=request.user.tenant, is_active=True
        )
        estimated_cost = PricingRate.get_cost(PricingRate.Key.SMS_OUTBOUND_PER_SEGMENT) * count_sms_segments(message)
        try:
            require_balance(request.user.tenant, estimated_cost)
        except InsufficientBalance as exc:
            return Response(
                {
                    "detail": f"Insufficient wallet balance (need ${exc.required}, have ${exc.available}).",
                    "code": "insufficient_balance",
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
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
            phone_number=sender_number,
        )
        bill_sms(interaction)

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
        _mark_contacted_if_needed(lead)

        # KNOWN GAP (fixed in the next batch, C5): substring matching opts
        # people out of messages like "please don't cancel my order".
        if any(keyword in text.upper() for keyword in STOP_KEYWORDS):
            lead.do_not_contact = True
            lead.save(update_fields=["do_not_contact"])
            propagate_global_opt_out(phone=lead.phone_number, email=lead.email)

        interaction = Interaction.objects.create(
            tenant=tenant,
            user=assigned_user,
            lead=lead,
            type=Interaction.Type.SMS,
            direction=Interaction.Direction.INBOUND,
            message_body=text,
            phone_number=phone_number,
        )
        # Inbound SMS is billed too (Telnyx charges for receiving). No
        # balance pre-check: we can't refuse to receive a text.
        # KNOWN GAP (fixed in the next batch, C3): no idempotency on
        # Telnyx retries.
        bill_sms(interaction)


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


class NumberViewSet(TenantModelViewSet):
    """
    Read + assign only. Numbers are CREATED exclusively by NumberPurchaseView
    (which buys them from Telnyx and bills the wallet) and REMOVED exclusively
    by NumberDeactivateView (which releases them at Telnyx). Allowing
    POST/PUT/DELETE here would let an admin create phantom numbers, or drop a
    number locally while Telnyx keeps billing you for it. The serializer also
    restricts PATCH to `assigned_user`.
    """

    serializer_class = PhoneNumberSerializer
    queryset = PhoneNumber.objects.all().order_by("-purchased_at")
    # An AGENT only sees numbers assigned to them; ADMIN sees the whole tenant.
    agent_owner_field = "assigned_user"
    http_method_names = ["get", "patch", "head", "options"]

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsAuthenticated(), IsTenantAdmin()]
        return [IsAuthenticated(), IsTenantMember()]


class NumberPurchaseView(APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def post(self, request):
        phone_number = normalize_to_e164((request.data.get("phone_number") or "").strip())
        if not phone_number:
            return Response({"detail": "phone_number is required."}, status=status.HTTP_400_BAD_REQUEST)
        if PhoneNumber.objects.filter(phone_number=phone_number).exists():
            return Response({"detail": "This number has already been purchased."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            require_platform_fee_current(request.user.tenant)
        except PlatformFeeOverdue as exc:
            return Response(
                {"detail": f"Platform fee (${exc.amount_due}) is overdue — top up to buy a number.",
                 "code": "platform_fee_overdue"},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        prorated_cost = calculate_number_purchase_cost()
        try:
            require_balance(request.user.tenant, prorated_cost)
        except InsufficientBalance as exc:
            return Response(
                {"detail": f"Insufficient wallet balance to buy a number (need ${exc.required}, have ${exc.available}).",
                 "code": "insufficient_balance"},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        try:
            order = purchase_number(phone_number)
        except TelnyxAPIError as exc:
            logger.exception("Number purchase failed")
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        # monthly_cost is deliberately NOT taken from the request body — the
        # client must never set what a number costs. The model default is used.
        number = PhoneNumber.objects.create(
            tenant=request.user.tenant,
            phone_number=phone_number,
            telnyx_order_id=order.get("id", ""),
            telnyx_phone_number_id=order.get("_phone_number_resource_id", ""),
            is_active=True,
        )

        bill_number_purchase(number)

        return Response(PhoneNumberSerializer(number).data, status=status.HTTP_201_CREATED)


class NumberDeactivateView(APIView):
    """
    POST /api/telephony/numbers/<id>/deactivate/  (ADMIN only)

    Releases the number from Telnyx and marks it inactive locally. Once
    released, this exact number cannot be re-enabled.
    """

    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def post(self, request, pk):
        number = get_object_or_404(PhoneNumber, pk=pk, tenant=request.user.tenant)

        if not number.is_active:
            return Response({"detail": "This number is already deactivated."}, status=status.HTTP_400_BAD_REQUEST)

        if number.telnyx_phone_number_id:
            try:
                release_number(number.telnyx_phone_number_id)
            except TelnyxAPIError as exc:
                logger.exception("Telnyx release failed for %s", number.phone_number)
                return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        else:
            logger.warning(
                "Number %s has no telnyx_phone_number_id on file — deactivating locally only; "
                "release it manually in the Telnyx portal.",
                number.phone_number,
            )

        number.is_active = False
        number.deactivated_at = timezone.now()
        number.assigned_user = None
        number.save(update_fields=["is_active", "deactivated_at", "assigned_user"])

        return Response(PhoneNumberSerializer(number).data)