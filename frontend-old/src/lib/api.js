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

// --- 402 Payment Required -> global lockout overlay ---------------------------------
//
// core.middleware.IsSubscriptionActive (Day 2) returns HTTP 402 for any
// PAID_OVERDUE tenant hitting a non-whitelisted endpoint. We don't want every
// call site to handle that individually, so this interceptor catches it once
// and notifies whoever is listening (App.jsx renders <PaymentOverdueOverlay />
// when notified). See onPaymentRequired() below.

let paymentRequiredHandler = null;

export function onPaymentRequired(handler) {
  paymentRequiredHandler = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 402 && paymentRequiredHandler) {
      paymentRequiredHandler(error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;
