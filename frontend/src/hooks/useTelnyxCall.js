import { useContext, useEffect, useState } from "react";
import { TelnyxRTCContext, useNotification } from "@telnyx/react-client";

function normalizeToE164(phoneNumber) {
  const digits = (phoneNumber || "").replace(/\D/g, "");
  if (!digits) return phoneNumber;
  const withCountryCode = digits.length === 10 ? `1${digits}` : digits;
  return `+${withCountryCode}`;
}

export default function useTelnyxCall() {
  const client = useContext(TelnyxRTCContext);
  const notification = useNotification();
  const activeCall = notification?.call;

  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const callState = activeCall?.state; // 'new' | 'ringing' | 'active' | 'hangup' | ...
  const inCall = callState === "active" || callState === "ringing" || callState === "new";
  const isIncomingRing = activeCall?.direction === "inbound" && callState === "ringing";

  useEffect(() => {
    if (callState !== "active") {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [callState]);

  useEffect(() => {
    if (!activeCall) setMuted(false);
  }, [activeCall]);

  const startCall = ({ destinationNumber, fromNumber, callerName }) => {
    if (!client || !destinationNumber || !fromNumber) return;
    client.newCall({
      destinationNumber: normalizeToE164(destinationNumber),
      callerNumber: fromNumber,
      callerName: callerName || "",
    });
  };

  const answer = () => activeCall?.answer();
  const hangup = () => activeCall?.hangup();
  const toggleMute = () => {
    if (!activeCall) return;
    muted ? activeCall.unmuteAudio?.() : activeCall.muteAudio?.();
    setMuted((m) => !m);
  };

  return { client, activeCall, callState, inCall, isIncomingRing, muted, elapsed, startCall, answer, hangup, toggleMute };
}