import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../lib/auth";

const IDLE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

/**
 * useIdleLogout — signs the user out after 5 minutes with no mouse/keyboard/
 * touch/scroll activity anywhere in the portal. Only mounted inside
 * PortalLayout, so it never runs on the public marketing site or the login
 * page itself. Uses the shared logout() so the refresh token is also
 * blacklisted server-side.
 */
export default function useIdleLogout() {
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId;

    const signOut = () => {
      logout();
      navigate("/login");
    };

    const resetTimer = () => {
      localStorage.setItem("last_active", String(Date.now()));
      clearTimeout(timeoutId);
      timeoutId = setTimeout(signOut, IDLE_LIMIT_MS);
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [navigate]);
}