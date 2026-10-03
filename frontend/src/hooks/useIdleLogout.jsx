import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../lib/auth";
import { isCallActive } from "../lib/callActivity";

// 5 minutes was too aggressive for a phone product: agents sit waiting for
// inbound calls. 15 min is a reasonable security/usability balance.
const IDLE_LIMIT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

export default function useIdleLogout() {
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId;

    const resetTimer = () => {
      localStorage.setItem("last_active", String(Date.now()));
      clearTimeout(timeoutId);
      timeoutId = setTimeout(signOut, IDLE_LIMIT_MS);
    };

    const signOut = () => {
      // Never sign someone out mid-call (talking counts as activity).
      if (isCallActive()) {
        resetTimer();
        return;
      }
      logout();
      navigate("/login");
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [navigate]);
}