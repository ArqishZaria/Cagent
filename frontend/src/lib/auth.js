import axios from "axios";
import { BASE_URL } from "./api";

export function logout() {
  const refresh = localStorage.getItem("refresh_token");

  // Clear local session first so the UI signs out instantly, even offline.
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("last_active");

  // Then revoke the refresh token server-side. Best-effort: if this fails the
  // user is still logged out locally, and the token expires on its own.
  if (refresh) {
    axios
      .post(`${BASE_URL}/api/auth/logout/`, { refresh }, { timeout: 5000 })
      .catch(() => {});
  }
}