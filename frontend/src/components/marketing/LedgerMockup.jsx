/**
 * LedgerMockup — the hero's signature element. Every AI-generated SaaS hero
 * reaches for an abstract 3D network mesh; this product's actual world is
 * calls and money logged in rows, so the hero shows exactly that: a live
 * ledger sheet, tilted slightly like a document on a desk, with real
 * event types (call, SMS, qualified lead) instead of decorative shapes.
 * Pure CSS/SVG — no animation library, no canvas.
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
      {/* faint duplicate sheet behind, for depth without a drop shadow */}
      <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-2xl border border-paper-300 bg-paper-100 rotate-1" />
      <div className="relative rounded-2xl border border-paper-200 bg-white shadow-raised-lg overflow-hidden -rotate-1">
        <div className="flex items-center justify-between px-5 py-4 border-b border-paper-200 bg-paper-50">
          <div>
            <p className="label-eyebrow">Today's ledger</p>
            <p className="font-display text-sm font-semibold text-ink-900">Acme Roofing &amp; Solar</p>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-live">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-live" />
            </span>
            live
          </span>
        </div>

        <div className="px-5">
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

        <div className="flex items-center justify-between px-5 py-3 border-t border-paper-200 bg-paper-50 text-[11px] font-mono text-ink-400">
          <span>5 events today</span>
          <span>synced just now</span>
        </div>
      </div>
    </div>
  );
}
