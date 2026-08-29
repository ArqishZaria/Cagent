import axios from "axios";

const BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://localhost:8000";

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

// Note: there is no longer a global 402 -> full-screen-lockout interceptor.
// Billing is enforced per-action now (wallet.services.require_balance), and
// each billable call site handles its own 402 inline — see
// AgenticProspector.jsx (scraper search), LeadChatPanel.jsx (SMS send), and
// TelnyxProvider.jsx (WebRTC credentials) for how each surfaces
// "insufficient_balance" without blocking the rest of the app.

export default api;