import { useEffect, useState } from "react";
import { TelnyxRTCProvider } from "@telnyx/react-client";
import api from "../lib/api";

/**
 * AppTelnyxProvider
 *
 * Fetches a short-lived WebRTC login_token from POST
 * /api/telephony/webrtc/credentials/ and initializes TelnyxRTCProvider with
 * it once ready.
 *
 * IMPORTANT: this always renders `children` regardless of the phone's
 * connection state. Wrapping the entire PortalLayout means a WebRTC failure
 * must never block the sidebar, leads, settings, or any other page — only
 * the dialer itself (via useContext(TelnyxRTCContext) being null/undefined)
 * should be affected when the phone isn't connected.
 */
export default function AppTelnyxProvider({ children }) {
  const [loginToken, setLoginToken] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .post("/api/telephony/webrtc/credentials/")
      .then((res) => {
        if (!cancelled) setLoginToken(res.data.login_token);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't initialize the phone. Refresh to try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // No token yet (still loading, or failed) — render the app normally
  // without WebRTC. Dialer.jsx already handles a missing client gracefully
  // (its call() guard checks `!client`), so calling is simply unavailable
  // rather than the whole portal being blocked.
  if (!loginToken) {
    return (
      <>
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