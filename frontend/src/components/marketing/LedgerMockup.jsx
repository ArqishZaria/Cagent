/**
 * DispatchTicketMockup (still exported as LedgerMockup — same import path
 * as before, no changes needed in Home.jsx) — the hero's signature element.
 * Instead of an abstract dashboard screenshot, this is a literal stack of
 * dispatch tickets: the real unit of work in this product is "a call got
 * logged," rendered as a torn, stamped, slightly-askew paper ticket.
 */
const ROWS = [
  { time: "09:14", who: "R. Delgado — Acura Roofing", kind: "Call", note: "4m 12s", tone: "live" },
  { time: "09:31", who: "Northside HVAC", kind: "SMS", note: "sent", tone: "signal" },
  { time: "09:47", who: "New number +1 415 555 0192", kind: "Setup", note: "$1.00/mo", tone: "amber" },
  { time: "10:02", who: "M. Okafor — qualified", kind: "Lead", note: "$4,200", tone: "signal" },
  { time: "10:15", who: "Prospector — Austin, TX", kind: "Found", note: "6 leads", tone: "amber" },
];

const DOT = { live: "bg-live", signal: "bg-signal", amber: "bg-amber" };
const FIG = { live: "text-live", signal: "text-signal", amber: "text-amber-dim" };

export default function LedgerMockup({ className = "" }) {
  return (
    <div className={`relative ${className}`} aria-hidden="true">
      {/* Two faint tickets underneath, fanned slightly, for depth */}
      <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-sm border border-paper-300 bg-paper-100 rotate-2" />
      <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-sm border border-paper-300 bg-paper-0 -rotate-1" />

      <div className="ticket relative shadow-raised-lg -rotate-1" style={{ "--ticket-bg": "#ECE6D7" }}>
        {/* Punched holes along the top, like a real ticket pad */}
        <div className="absolute -top-[7px] left-6 punch-hole" />
        <div className="absolute -top-[7px] right-6 punch-hole" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="label-eyebrow">Dispatch ticket · today</p>
            <p className="font-display text-base font-semibold text-ink-900">Acme Roofing &amp; Solar</p>
          </div>
          <span className="stamp stamp-live animate-stamp-in">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-live" />
            </span>
            Live
          </span>
        </div>

        <div>
          {ROWS.map((row, i) => (
            <div
              key={row.time}
              className="ledger-row animate-ledger-in"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${DOT[row.tone]}`} />
                <span className="text-ink-400 w-11 shrink-0">{row.time}</span>
                <span className="text-ink-800 truncate">{row.who}</span>
              </span>
              <span className={`shrink-0 ${FIG[row.tone]}`}>{row.note}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 mt-1 border-t border-dashed border-paper-300 text-[11px] font-mono text-ink-400">
          <span>5 entries today</span>
          <span>logged just now</span>
        </div>
      </div>
    </div>
  );
}