import { useEffect, useState } from "react";

/**
 * LiveTicker — a scrolling strip of the kind of events the product actually
 * generates (call connected, lead qualified, SMS sent). Dramatizes "this
 * platform is alive and working" without inventing fake stats — every line
 * here corresponds to a real event type the backend logs today
 * (Interaction rows, Lead status changes).
 */
const EVENTS = [
  { text: "+1 512 555 0138 connected", tone: "live", meta: "0:42" },
  { text: "Lead qualified — Acura Roofing, TX", tone: "signal", meta: "just now" },
  { text: "SMS sent — \"Following up on your quote\"", tone: "signal", meta: "2s ago" },
  { text: "New number provisioned — +1 415 555 0192", tone: "amber", meta: "1m ago" },
  { text: "Inbound call routed to agent", tone: "live", meta: "3m ago" },
  { text: "Prospector found 4 new leads — Austin, TX", tone: "signal", meta: "5m ago" },
  { text: "Lead replied STOP — opted out, compliant", tone: "amber", meta: "6m ago" },
];

const TONE_CLASSES = {
  live: "bg-live",
  signal: "bg-signal-bright",
  amber: "bg-amber",
};

export default function LiveTicker({ className = "" }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= EVENTS.length) return;
    const id = setTimeout(() => setVisibleCount((c) => c + 1), 420);
    return () => clearTimeout(id);
  }, [visibleCount]);

  return (
    <div className={`font-mono text-xs space-y-2 ${className}`}>
      {EVENTS.slice(0, visibleCount).map((event, i) => (
        <div
          key={event.text}
          className="flex items-center gap-2.5 text-ink-200 animate-fade-up"
          style={{ animationDelay: "0s" }}
        >
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${TONE_CLASSES[event.tone]}`} />
          <span className="text-ink-50">{event.text}</span>
          <span className="text-ink-300">· {event.meta}</span>
        </div>
      ))}
    </div>
  );
}