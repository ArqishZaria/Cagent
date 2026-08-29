import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { useWallet } from "../lib/wallet";

/**
 * LowBalanceBanner — the in-app counterpart to the backend's one-time
 * low-balance email (wallet.notifications.notify_low_balance, fired when
 * balance crosses <= $1). Shown across the whole portal but dismissible
 * per session — never blocks anything, just nudges toward Upload Finance.
 */
export default function LowBalanceBanner() {
  const { wallet } = useWallet();
  const [dismissed, setDismissed] = useState(false);

  if (!wallet || !wallet.is_low || dismissed) return null;

  return (
    <div className="bg-alert/10 border-b border-alert/25 px-4 py-2.5 flex items-center justify-center gap-3 text-sm">
      <AlertTriangle size={15} className="text-alert shrink-0" />
      <span className="text-ink-800">
        Wallet balance is ${Number(wallet.balance_usd).toFixed(2)} — calls, texts, and lead searches will stop
        once it hits $0.
      </span>
      <Link to="/app/finance/upload" className="text-alert font-medium hover:underline shrink-0">
        Top up now
      </Link>
      <button onClick={() => setDismissed(true)} className="text-ink-400 hover:text-ink-900 shrink-0" aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}