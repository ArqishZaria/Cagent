/**
 * SignalBars — the one visual motif reused everywhere calls/leads are "live":
 * the WebRTC dialer's active-call visualizer, the scraper's loading state,
 * and small status indicators. Each bar animates on its own delay so it reads
 * as an audio waveform rather than a generic spinner.
 */
export default function SignalBars({
  bars = 5,
  color = "signal",
  size = "md",
  active = true,
  className = "",
}) {
  const heights = {
    sm: "h-3",
    md: "h-6",
    lg: "h-10",
  }[size];

  const colorClass = {
    signal: "bg-signal",
    live: "bg-live",
    amber: "bg-amber",
    alert: "bg-alert",
  }[color];

  return (
    <div className={`flex items-end gap-[3px] ${heights} ${className}`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${colorClass} ${active ? "animate-signal-bar" : ""}`}
          style={{
            height: "100%",
            animationDelay: `${i * 0.12}s`,
            transform: active ? undefined : "scaleY(0.35)",
            opacity: active ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}
