import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TelnyxRTCContext, useNotification } from "@telnyx/react-client";
import { ArrowRight, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import SignalBars from "./SignalBars";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

/**
 * Dialer — the right-hand WebRTC dialpad. Reads the Telnyx client off
 * TelnyxRTCContext (provided by AppTelnyxProvider higher up the tree) and
 * drives calls through it directly, per @telnyx/react-client's documented
 * pattern of using the context client rather than a second client instance.
 */
export default function Dialer({ activeLead, onSaveNote, fromNumber }) {
  const client = useContext(TelnyxRTCContext);
  const notification = useNotification();
  const activeCall = notification?.call;

  const [digits, setDigits] = useState("");
  const [muted, setMuted] = useState(false);
  const [note, setNote] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const callState = activeCall?.state; // 'new' | 'ringing' | 'active' | 'hangup' | ...
  const inCall = callState === "active" || callState === "ringing" || callState === "new";

  useEffect(() => {
    if (callState !== "active") {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [callState]);

  const press = (key) => setDigits((d) => d + key);

  const call = () => {
    const destination = activeLead?.phone_number || digits;
    if (!destination || !client) return;
    client.newCall({ destinationNumber: destination, callerName: activeLead?.company || "" });
  };

  const hangup = () => {
    activeCall?.hangup();
    if (note.trim() && onSaveNote) onSaveNote(note.trim());
    setNote("");
  };

  const toggleMute = () => {
    if (!activeCall) return;
    muted ? activeCall.unmuteAudio?.() : activeCall.muteAudio?.();
    setMuted((m) => !m);
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="card-raised p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-5">
        <span className="label-eyebrow">WebRTC dialer</span>
        {callState && (
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
              callState === "active" ? "bg-live/10 text-live" : "bg-amber/10 text-amber-dim"
            }`}
          >
            {callState}
          </span>
        )}
      </div>

      {!fromNumber && (
        <div className="flex items-center gap-2 rounded-lg border border-amber/25 bg-amber/[0.06] px-3 py-2.5 mb-2 text-xs text-ink-700">
          <span className="flex-1">No caller ID connected yet — outbound calls won't show your business number.</span>
          <Link to="/app/settings" className="inline-flex items-center gap-1 text-amber-dim font-medium shrink-0 hover:underline">
            Buy a number <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* Active-call visualizer — the signature signal-bars motif, doing
          real work here as a live-audio indicator rather than decoration. */}
      <div className="flex flex-col items-center justify-center py-6">
        <SignalBars bars={7} size="lg" color={callState === "active" ? "live" : "signal"} active={inCall} />
        <p className="font-mono text-2xl mt-4 text-ink-900">
          {callState === "active" ? formatTime(elapsed) : digits || activeLead?.phone_number || "—"}
        </p>
        {activeLead && (
          <p className="text-xs text-ink-500 mt-1">
            {activeLead.first_name} {activeLead.last_name}
          </p>
        )}
      </div>

      {/* Dialpad */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {KEYS.map((key) => (
          <button
            key={key}
            onClick={() => press(key)}
            disabled={inCall}
            className="aspect-square rounded-xl bg-white border border-paper-300
                       shadow-key active:shadow-key-active active:translate-y-[2px]
                       text-lg font-display font-medium text-ink-900
                       hover:bg-paper-100 transition disabled:opacity-30 disabled:pointer-events-none"
          >
            {key}
          </button>
        ))}
      </div>

      {/* Call controls */}
      <div className="flex items-center justify-center gap-4 mb-5">
        {!inCall ? (
          <button
            onClick={call}
            disabled={!digits && !activeLead}
            className="btn-primary !rounded-full !p-4 shadow-raised-lg"
            aria-label="Call"
          >
            <Phone size={20} />
          </button>
        ) : (
          <>
            <button
              onClick={toggleMute}
              className="btn-secondary !rounded-full !p-3.5"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={hangup}
              className="!rounded-full !p-4 bg-alert text-white
                         shadow-raised-lg border border-alert-dim/40 hover:bg-alert-dim transition"
              aria-label="Hang up"
            >
              <PhoneOff size={20} />
            </button>
          </>
        )}
      </div>

      {/* Call notes */}
      <div className="mt-auto pt-4 border-t border-paper-200">
        <label className="label-eyebrow block mb-2">Call notes</label>
        <textarea
          className="input-field !text-sm resize-none h-20"
          placeholder="What happened on this call?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </div>
  );
}
