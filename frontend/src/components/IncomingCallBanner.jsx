import { useNotification } from "@telnyx/react-client";
import { useNavigate, useLocation } from "react-router-dom";
import { Phone, PhoneOff } from "lucide-react";

/**
 * IncomingCallBanner — a floating alert shown on every page under /app
 * whenever an inbound call is ringing, so an agent doesn't need to already
 * be on the CRM/dialer page to notice and answer it. Answering navigates to
 * the dialer page, where Dialer.jsx's <Audio> element and full call controls
 * (mute, hangup, notes) take over — this banner is deliberately hidden while
 * already on that page to avoid showing two separate answer/decline controls
 * for the same call.
 */
export default function IncomingCallBanner() {
  const notification = useNotification();
  const activeCall = notification?.call;
  const navigate = useNavigate();
  const location = useLocation();

  const isRinging = activeCall?.direction === "inbound" && activeCall?.state === "ringing";

  if (!isRinging || location.pathname === "/app") return null;

  const answer = () => {
    activeCall.answer();
    navigate("/app");
  };

  const decline = () => {
    activeCall.hangup();
  };

  const callerNumber =
    activeCall.options?.remoteCallerNumber || activeCall.remoteCallerNumber || "Unknown number";

  return (
    <div className="fixed top-4 right-4 z-50 card-raised p-4 flex items-center gap-4 animate-fade-up">
      <div className="w-10 h-10 rounded-full bg-live/10 text-live flex items-center justify-center shrink-0">
        <Phone size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-display font-semibold text-ink-900">Incoming call</p>
        <p className="text-xs text-ink-500 truncate">{callerNumber}</p>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <button
          onClick={answer}
          className="btn-primary !p-2.5 !rounded-full bg-live border-live-dim/40"
          aria-label="Answer"
        >
          <Phone size={16} />
        </button>
        <button
          onClick={decline}
          className="!p-2.5 !rounded-full bg-alert text-white hover:bg-alert-dim transition"
          aria-label="Decline"
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </div>
  );
}