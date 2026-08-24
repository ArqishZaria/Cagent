import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";

export default function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="relative bg-signal text-white">
      <div className="max-w-7xl mx-auto px-10 sm:px-6 py-2.5 flex items-center justify-center gap-2 text-center text-[13px]">
        <span className="font-mono uppercase tracking-wide text-white/70 hidden sm:inline">New</span>
        <span>The Prospector now qualifies leads while your team is off the phone.</span>
        <Link to="/pricing" className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:no-underline shrink-0">
          See plans <ArrowRight size={12} />
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition p-1"
        aria-label="Dismiss announcement"
      >
        <X size={14} />
      </button>
    </div>
  );
}
