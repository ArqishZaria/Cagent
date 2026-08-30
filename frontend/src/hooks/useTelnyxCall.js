import { useContext, useEffect, useRef, useState } from "react";
import { TelnyxRTCContext, useNotification } from "@telnyx/react-client";
import api from "../lib/api";

function normalizeToE164(phoneNumber) {
  const digits = (phoneNumber || "").replace(/\D/g, "");
  if (!digits) return phoneNumber;
  const withCountryCode = digits.length === 10 ? `1${digits}` : digits;
  return `+${withCountryCode}`;
}

const ENDED_STATES = ["hangup", "destroy", "purge"];

/**
 * useTelnyxCall — central call state, shared by LeadChatPanel (to start
 * calls) and CallWidget (to render/control them).
 *
 * Only one call is ever "primary" (shown/controllable) at a time. If a
 * second call rings in while one is active, it's offered as a WhatsApp-style
 * "waiting call" — accepting it hangs up the current call first; declining
 * it rejects the new one and leaves the current call untouched. A third
 * simultaneous call is auto-declined outright.
 *
 * Outbound calls (started via startCall, always tied to a lead) are logged
 * to /api/interactions/ on hangup. Inbound calls are already logged
 * server-side by telephony.views.VoiceWebhookView, so they're not
 * double-logged here.
 *
 * startCall is now async: it first hits
 * POST /api/telephony/calls/check-balance/ (telephony.views.CallEligibilityView)
 * so a call never even rings if the wallet can't cover at least one minute
 * at the outbound rate. On a 402, `callError` is set and the call never
 * starts — surfaced by LeadChatPanel right under the lead header.
 */
export default function useTelnyxCall() {
  const client = useContext(TelnyxRTCContext);
  const notification = useNotification();
  const incomingCall = notification?.call;

  const primaryCallRef = useRef(null);
  const waitingCallRef = useRef(null);
  const callMetaRef = useRef(null); // { leadId, fromNumberId } for the primary call, if outbound
  const elapsedRef = useRef(0);

  const [activeCall, setActiveCall] = useState(null);
  const [waitingCall, setWaitingCall] = useState(null);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [callError, setCallError] = useState("");

  const logCall = (call, meta, durationSeconds) => {
    if (!meta?.leadId) return; // no lead context (e.g. inbound) — server already logged it
    api
      .post("/api/interactions/", {
        lead: meta.leadId,
        type: "CALL",
        direction: call?.direction === "inbound" ? "INBOUND" : "OUTBOUND",
        duration_seconds: Math.max(0, Math.round(durationSeconds || 0)),
        phone_number: meta.fromNumberId || null,
      })
      .catch(() => {
        /* best-effort — a missed log entry shouldn't interrupt the call flow */
      });
  };

  useEffect(() => {
    if (!incomingCall) return;
    const isEnded = ENDED_STATES.includes(incomingCall.state);

    // Event for the call we're currently tracking as primary.
    if (primaryCallRef.current && primaryCallRef.current.id === incomingCall.id) {
      if (isEnded) {
        logCall(incomingCall, callMetaRef.current, elapsedRef.current);
        primaryCallRef.current = null;
        callMetaRef.current = null;
        setActiveCall(null);
      } else {
        setActiveCall(incomingCall);
      }
      return;
    }

    // Event for the call currently waiting in the wings.
    if (waitingCallRef.current && waitingCallRef.current.id === incomingCall.id) {
      if (isEnded) {
        waitingCallRef.current = null;
        setWaitingCall(null);
      } else {
        setWaitingCall(incomingCall);
      }
      return;
    }

    if (isEnded) return; // an id we never tracked, already over — ignore

    if (primaryCallRef.current) {
      if (waitingCallRef.current) {
        // Already juggling a primary + one waiting call — decline a third.
        try {
          incomingCall.reject ? incomingCall.reject() : incomingCall.hangup?.();
        } catch {
          /* best-effort */
        }
        return;
      }
      waitingCallRef.current = incomingCall;
      setWaitingCall(incomingCall);
      return;
    }

    primaryCallRef.current = incomingCall;
    setActiveCall(incomingCall);
  }, [incomingCall]);

  const callState = activeCall?.state;
  const inCall = callState === "active" || callState === "ringing" || callState === "new";
  const isIncomingRing = activeCall?.direction === "inbound" && callState === "ringing";

  useEffect(() => {
    if (callState !== "active") {
      elapsedRef.current = 0;
      setElapsed(0);
      return;
    }
    const id = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [callState]);

  useEffect(() => {
    if (!activeCall) setMuted(false);
  }, [activeCall]);

  const startCall = async ({ destinationNumber, fromNumber, fromNumberId, callerName, leadId }) => {
    if (!client || !destinationNumber || !fromNumber) return;
    if (primaryCallRef.current) return; // already on a call — refuse to start a second

    try {
      await api.post("/api/telephony/calls/check-balance/");
    } catch (err) {
      setCallError(
        err.response?.data?.code === "insufficient_balance"
          ? "Wallet balance too low to place this call — top up to keep calling."
          : "Couldn't verify wallet balance. Try again."
      );
      return;
    }

    setCallError("");
    callMetaRef.current = { leadId, fromNumberId };
    client.newCall({
      destinationNumber: normalizeToE164(destinationNumber),
      callerNumber: fromNumber,
      callerName: callerName || "",
    });
  };

  const answer = () => activeCall?.answer();

  const hangup = () => {
    if (!activeCall) return;
    const call = activeCall;

    try {
      if (isIncomingRing) {
        call.reject ? call.reject() : call.hangup?.();
      } else {
        call.hangup?.();
      }
    } catch {
      /* best-effort — still close the UI below regardless */
    }

    // Close the widget immediately rather than waiting on the SDK's own
    // state transition, which can lag (or never arrive) for calls that
    // were only ever ringing.
    if (primaryCallRef.current?.id === call.id) {
      logCall(call, callMetaRef.current, elapsedRef.current);
      primaryCallRef.current = null;
      callMetaRef.current = null;
      setActiveCall(null);
    }
  };
  const acceptWaiting = () => {
    const incoming = waitingCallRef.current;
    if (!incoming) return;
    waitingCallRef.current = null;
    setWaitingCall(null);

    if (primaryCallRef.current) {
      try {
        primaryCallRef.current.hangup();
      } catch {
        /* best-effort */
      }
    }

    primaryCallRef.current = incoming;
    callMetaRef.current = null; // inbound — no lead/number context to log client-side
    setActiveCall(incoming);
    incoming.answer();
  };

  const declineWaiting = () => {
    const incoming = waitingCallRef.current;
    if (!incoming) return;
    waitingCallRef.current = null;
    setWaitingCall(null);
    try {
      incoming.reject ? incoming.reject() : incoming.hangup?.();
    } catch {
      /* best-effort */
    }
  };

  const toggleMute = () => {
    if (!activeCall) return;
    muted ? activeCall.unmuteAudio?.() : activeCall.muteAudio?.();
    setMuted((m) => !m);
  };

  return {
    client,
    activeCall,
    callState,
    inCall,
    isIncomingRing,
    muted,
    elapsed,
    waitingCall,
    callError,
    startCall,
    answer,
    hangup,
    acceptWaiting,
    declineWaiting,
    toggleMute,
  };
}