/**
 * AmbientBackdrop — the site's "it's alive" layer. Three soft, blurred
 * fields in the brand palette drift slowly behind hero content, plus a
 * faint dot-grid for texture. Never interactive, never above content
 * (pointer-events-none, z-0), and calm enough to sit behind body text.
 */
export default function AmbientBackdrop({ className = "" }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
      <div
        className="absolute -top-24 -left-16 w-[420px] h-[420px] rounded-full bg-signal/[0.07] blur-3xl animate-drift-a"
      />
      <div
        className="absolute top-10 right-[-80px] w-[380px] h-[380px] rounded-full bg-amber/[0.08] blur-3xl animate-drift-b"
      />
      <div
        className="absolute bottom-[-120px] left-1/3 w-[460px] h-[460px] rounded-full bg-live/[0.06] blur-3xl animate-drift-c"
      />
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: "radial-gradient(rgba(28,26,22,0.05) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
    </div>
  );
}
