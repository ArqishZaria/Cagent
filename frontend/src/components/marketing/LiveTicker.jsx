import { useEffect, useState } from "react";

/**
 * LiveTicker — a scrolling ledger of the kind of events the product actually
 * generates (call connected, lead qualified, SMS sent). Dramatizes "this
 * platform is alive and working" without inventing fake stats — every line
 * here corresponds to a real event type the backend logs today
 * (Interaction rows, Lead status changes). Styled as a ruled ledger, the
 * page's one signature motif, rather than a generic activity toast list.
 */
const EVENTS = [
  { text: "Call connected — +1 512 555 0138", tone: "live", meta: "0:42" },
  { text: "Lead qualified — Acura Roofing, TX", tone: "signal", meta: "now" },
  { text: "SMS sent — following up on your quote", tone: "signal", meta: "2s" },
  { text: "Number provisioned — +1 415 555 0192", tone: "amber", meta: "1m" },
  { text: "Inbound call routed to agent", tone: "live", meta: "3m" },
  { text: "Prospector found 4 leads — Austin, TX", tone: "signal", meta: "5m" },
  { text: "Lead replied STOP — opted out, compliant", tone: "amber", meta: "6m" },
];

const TONE_CLASSES = {
  live: "bg-live",
  signal: "bg-signal",
  amber: "bg-amber",
};

export default function LiveTicker({ className = "" }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= EVENTS.length) return;
    const id = setTimeout(() => setVisibleCount((c) => c + 1), 380);
    return () => clearTimeout(id);
  }, [visibleCount]);

  return (
    <div className={`font-mono text-[13px] ${className}`}>
      {EVENTS.slice(0, visibleCount).map((event, i) => (
        <div
          key={event.text}
          className="ledger-row animate-ledger-in"
          style={{ animationDelay: "0s" }}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${TONE_CLASSES[event.tone]}`} />
            <span className="text-ink-800 truncate">{event.text}</span>
          </span>
          <span className="text-ink-400 shrink-0">{event.meta}</span>
        </div>
      ))}
    </div>
  );
}
