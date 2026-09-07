import { useEffect, useState } from "react";
import { TelnyxRTCProvider } from "@telnyx/react-client";
import { Link } from "react-router-dom";
import api from "../lib/api";

/**
 * AppTelnyxProvider
 *
 * Fetches a short-lived WebRTC login_token from POST
 * /api/telephony/webrtc/credentials/. That endpoint 402s with
 * code="insufficient_balance" when the wallet is at $0, or
 * code="platform_fee_overdue" when the recurring platform fee couldn't be
 * charged (see telephony.views.WebRTCCredentialsView) — both surfaced here
 * as small, non-blocking notices rather than a generic connection-error
 * message, since they're expected, actionable states, not failures.
 *
 * Always renders `children` regardless of connection state — an empty
 * wallet, an overdue platform fee, or a WebRTC failure must never block
 * the sidebar, leads, settings, or any other page, only the dialer itself.
 */
export default function AppTelnyxProvider({ children }) {
  const [loginToken, setLoginToken] = useState(null);
  const [error, setError] = useState(null);
  const [insufficientBalance, setInsufficientBalance] = useState(false);
  const [platformFeeOverdue, setPlatformFeeOverdue] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .post("/api/telephony/webrtc/credentials/")
      .then((res) => {
        if (!cancelled) setLoginToken(res.data.login_token);
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err.response?.data?.code;
        if (code === "insufficient_balance") {
          setInsufficientBalance(true);
        } else if (code === "platform_fee_overdue") {
          setPlatformFeeOverdue(true);
        } else {
          setError("Couldn't initialize the phone. Refresh to try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loginToken) {
    return (
      <>
        {insufficientBalance && (
          <div className="fixed bottom-4 left-4 z-50 text-xs bg-white border border-alert/25 rounded-lg px-3 py-2.5 shadow-raised-lg max-w-xs">
            <span className="text-ink-700">Wallet is empty — calling is disabled until you top up.</span>{" "}
            <Link to="/app/finance/upload" className="text-alert font-medium hover:underline">
              Top up
            </Link>
          </div>
        )}
        {platformFeeOverdue && (
          <div className="fixed bottom-4 left-4 z-50 text-xs bg-white border border-alert/25 rounded-lg px-3 py-2.5 shadow-raised-lg max-w-xs">
            <span className="text-ink-700">Platform fee overdue — calling is disabled until you top up.</span>{" "}
            <Link to="/app/finance/upload" className="text-alert font-medium hover:underline">
              Top up
            </Link>
          </div>
        )}
        {error && (
          <div className="fixed bottom-4 left-4 z-50 text-xs text-alert font-mono bg-white border border-alert/25 rounded-lg px-3 py-2 shadow-raised-lg">
            {error}
          </div>
        )}
        {children}
      </>
    );
  }

  const credential = { login_token: loginToken };
  const options = {
    ringtoneFile: "/sounds/ringtone.mp3",
    ringbackFile: "/sounds/ringback.mp3",
  };

  return (
    <TelnyxRTCProvider credential={credential} options={options}>
      {children}
    </TelnyxRTCProvider>
  );
}