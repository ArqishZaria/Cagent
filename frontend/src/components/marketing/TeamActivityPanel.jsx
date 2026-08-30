import { useEffect, useState } from "react";

const AGENTS = [
  { initials: "DR", name: "Dana R.", status: "On call", tone: "green", duration: 0 },
  { initials: "MO", name: "Marcus O.", status: "Texting lead", tone: "yellow" },
  { initials: "SK", name: "Sana K.", status: "Reviewing pipeline", tone: "muted" },
  { initials: "AH", name: "Amir H.", status: "On call", tone: "green", duration: 0 },
];

const TONE = {
  green: { dot: "bg-mkt-green", text: "text-mkt-green", ring: "ring-mkt-green/30" },
  yellow: { dot: "bg-mkt-yellow", text: "text-mkt-yellow", ring: "ring-mkt-yellow/30" },
  muted: { dot: "bg-white/30", text: "text-white/40", ring: "ring-white/10" },
};

/**
 * TeamActivityPanel — replaces a stock "team on calls" photo with a live,
 * on-brand illustration: a small roster of agents with animated call
 * timers and status dots, inside the same glass treatment used elsewhere
 * on the marketing site. Self-contained — no external image fetch, so it
 * never renders empty.
 */
export default function TeamActivityPanel() {
  const [ticks, setTicks] = useState(() => AGENTS.map((a) => a.duration ?? null));

  useEffect(() => {
    const id = setInterval(() => {
      setTicks((prev) => prev.map((t) => (t === null ? null : t + 1)));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="relative">
      {/* ambient glow behind the panel, consistent with hero/CTA sections */}
      <div
        className="absolute -inset-6 rounded-[2rem] bg-mkt-green/[0.06] blur-[60px] pointer-events-none"
        aria-hidden="true"
      />
      <div className="relative mkt-glass-card !p-0 overflow-hidden hover:!translate-y-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mkt-green opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-mkt-green" />
            </span>
            <span className="text-xs font-mono uppercase tracking-wide text-mkt-muted">
              Team activity · live
            </span>
          </div>
          <span className="text-xs font-mono text-white/40">4 agents</span>
        </div>

        <div className="divide-y divide-white/10">
          {AGENTS.map((agent, i) => {
            const t = TONE[agent.tone];
            return (
              <div
                key={agent.name}
                className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.03] transition"
              >
                <span
                  className={`relative w-10 h-10 rounded-full bg-white/[0.06] ring-1 ${t.ring}
                              flex items-center justify-center font-mono text-xs font-semibold text-white shrink-0`}
                >
                  {agent.initials}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${t.dot} border-2 border-mkt-panel`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{agent.name}</p>
                  <p className={`text-xs ${t.text} truncate`}>{agent.status}</p>
                </div>
                {ticks[i] !== null && (
                  <span className="font-mono text-xs text-white/50 shrink-0">{fmt(ticks[i])}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-6 py-3.5 border-t border-white/10 bg-white/[0.02]">
          <span className="text-[11px] font-mono text-mkt-muted">Every call logged automatically</span>
          <span className="text-[11px] font-mono text-mkt-green">synced now</span>
        </div>
      </div>

      {/* floating stat chip, echoes the marketing Home hero's "+32%" chip */}
      <div className="hidden sm:flex absolute -bottom-5 -left-6 items-center gap-2.5 mkt-glass-card !p-3.5 !rounded-xl">
        <span className="w-8 h-8 rounded-lg bg-mkt-green/10 text-mkt-green flex items-center justify-center shrink-0">
          <Bolt />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white font-mono">+32%</p>
          <p className="text-[11px] text-mkt-muted">leads worked this week</p>
        </div>
      </div>
    </div>
  );
}

function Bolt() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}