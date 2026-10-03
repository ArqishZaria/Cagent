import axios from "axios";
export const BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE_URL,
});

// --- JWT attachment -----------------------------------------------------------------

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Automatic refresh-on-401 --------------------------------------------------------
// Access tokens live 8h with nothing proactively renewing them, so the first request
// after expiry gets a 401. Rather than surface that as a broken page mid-session, we
// swap in a fresh access token via /api/auth/token/refresh/ and retry the ORIGINAL
// request once. If refresh itself fails (refresh token expired/revoked/missing), we
// clear storage and send the user to /login — the only place that happens
// automatically; useIdleLogout's timer-based logout is separate and untouched.
//
// refreshPromise is shared across every request that 401s in the same moment (several
// panels can be polling at once — CrmDialerView, LeadChatPanel, wallet banners all
// poll independently) so we never fire simultaneous refresh calls: ROTATE_REFRESH_TOKENS
// + BLACKLIST_AFTER_ROTATION means only the FIRST rotated refresh token stays valid —
// a second concurrent refresh call would blacklist the first and could race it.
let refreshPromise = null;

function clearSessionAndRedirect() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("last_active");
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (!response || response.status !== 401 || config._retried) {
      return Promise.reject(error);
    }
    // A 401 from the auth endpoints themselves means the session is genuinely over —
    // never try to "refresh" our way out of a failed login or a failed refresh.
    if (config.url?.includes("/api/auth/token/")) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      clearSessionAndRedirect();
      return Promise.reject(error);
    }

    config._retried = true;

    if (!refreshPromise) {
      refreshPromise = axios
        .post(`${BASE_URL}/api/auth/token/refresh/`, { refresh: refreshToken })
        .then((res) => {
          localStorage.setItem("access_token", res.data.access);
          if (res.data.refresh) {
            // ROTATE_REFRESH_TOKENS is on — SimpleJWT hands back a new refresh token too.
            localStorage.setItem("refresh_token", res.data.refresh);
          }
          return res.data.access;
        })
        .catch((refreshErr) => {
          // Only a rejected refresh token means the session is truly over.
          // 429s, 5xx and network errors are transient - keep the session.
          const status = refreshErr.response?.status;
          if (status === 400 || status === 401) clearSessionAndRedirect();
          throw refreshErr;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const newAccessToken = await refreshPromise;
    config.headers.Authorization = `Bearer ${newAccessToken}`;
    return api(config);
  }
);

// Note: there is no longer a global 402 -> full-screen-lockout interceptor.
// Billing is enforced per-action now (wallet.services.require_balance), and
// each billable call site handles its own 402 inline — see
// AgenticProspector.jsx (scraper search), LeadChatPanel.jsx (SMS send), and
// TelnyxProvider.jsx (WebRTC credentials) for how each surfaces
// "insufficient_balance" without blocking the rest of the app.

export default api;