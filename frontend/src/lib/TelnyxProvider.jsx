import { useEffect, useState } from "react";
import { TelnyxRTCProvider } from "@telnyx/react-client";
import api from "../lib/api";
import { TELNYX_RTC_ICE_SERVERS } from "../lib/telnyxIceServers";

/**
 * AppTelnyxProvider
 *
 * Fetches a short-lived WebRTC login_token from POST
 * /api/telephony/webrtc/credentials/ (the real Day 3 endpoint —
 * telephony.services.generate_webrtc_jwt) and initializes
 * TelnyxRTCProvider with it.
 *
 * ICE servers are explicitly passed via `options.iceServers`, hardcoded to
 * Telnyx's own STUN/TURN infrastructure (see lib/telnyxIceServers.js) rather
 * than left to the SDK default, so the dialer keeps working from behind
 * strict corporate firewalls that only allow outbound TCP/443 — that's what
 * TELNYX_TURNS_TCP_443 is for.
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

  if (error) {
    return <div className="text-xs text-alert font-mono px-4 py-2">{error}</div>;
  }

  if (!loginToken) {
    return <div className="text-xs text-ink-500 font-mono px-4 py-2">Connecting phone…</div>;
  }

  const credential = { login_token: loginToken };
  const options = {
    iceServers: TELNYX_RTC_ICE_SERVERS,
    ringtoneFile: "/sounds/ringtone.mp3",
    ringbackFile: "/sounds/ringback.mp3",
  };

  return (
    <TelnyxRTCProvider credential={credential} options={options}>
      {children}
    </TelnyxRTCProvider>
  );
}
