import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { Audio } from "@telnyx/react-client";
import SignalBars from "./SignalBars";
import useTelnyxCall from "../hooks/useTelnyxCall";

export default function CallWidget() {
  const { activeCall, callState, inCall, isIncomingRing, muted, elapsed, answer, hangup, toggleMute } = useTelnyxCall();

  if (!activeCall) return null;

  const name = activeCall.options?.remoteCallerName || activeCall.options?.callerName || "Unknown";
  const number = activeCall.options?.remoteCallerNumber || activeCall.options?.destinationNumber || "";
  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 card-raised overflow-hidden animate-fade-up">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-paper-200 bg-paper-50">
        <span className="text-[11px] font-mono uppercase tracking-wide text-ink-500">
          {callState === "active" ? formatTime(elapsed) : callState}
        </span>
        <button onClick={hangup} className="text-ink-400 hover:text-alert transition text-xs">
          End
        </button>
      </div>

      <div className="flex flex-col items-center py-6 px-4">
        <SignalBars bars={7} size="md" color={callState === "active" ? "live" : "signal"} active={inCall} />
        <p className="font-display font-semibold text-base text-ink-900 mt-4 truncate max-w-full">{name}</p>
        <p className="font-mono text-xs text-ink-500 mt-0.5">{number}</p>
      </div>

      <div className="flex items-center justify-center gap-4 pb-5">
        {isIncomingRing ? (
          <>
            <button onClick={answer} className="btn-primary !rounded-full !p-3.5 bg-live border-live-dim/40" aria-label="Answer">
              <Phone size={18} />
            </button>
            <button onClick={hangup} className="!rounded-full !p-3.5 bg-alert text-white border border-alert-dim/40 hover:bg-alert-dim transition" aria-label="Decline">
              <PhoneOff size={18} />
            </button>
          </>
        ) : (
          <>
            <button onClick={toggleMute} className="btn-secondary !rounded-full !p-3" aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button onClick={hangup} className="!rounded-full !p-3.5 bg-alert text-white border border-alert-dim/40 hover:bg-alert-dim transition" aria-label="Hang up">
              <PhoneOff size={18} />
            </button>
          </>
        )}
      </div>

      <Audio stream={activeCall.remoteStream} />
    </div>
  );
}