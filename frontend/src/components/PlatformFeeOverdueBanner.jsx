import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useWallet } from "../lib/wallet";

/**
 * Not dismissible on purpose — calling/texting/search are actually blocked
 * server-side while this is true, so hiding the banner would just make the
 * lockout confusing.
 */
export default function PlatformFeeOverdueBanner() {
  const { wallet } = useWallet();
  if (!wallet || !wallet.platform_fee_overdue) return null;

  return (
    <div className="bg-alert text-white px-4 py-2.5 flex items-center justify-center gap-3 text-sm">
      <AlertTriangle size={15} className="shrink-0" />
      <span>
        Your ${wallet.platform_fee_amount_usd || "15.00"} monthly platform fee couldn't be charged — calling,
        texting, and lead search are paused until you top up.
      </span>
      <Link to="/app/finance/upload" className="font-semibold underline shrink-0">
        Top up now
      </Link>
    </div>
  );
}