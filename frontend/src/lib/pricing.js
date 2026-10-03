import { useEffect, useState } from "react";
import api from "./api";

export function usePricing() {
  const [rates, setRates] = useState(null);
  useEffect(() => {
    api.get("/api/wallet/public-pricing/").then((r) => setRates(r.data)).catch(() => {});
  }, []);
  const get = (key) => (rates?.[key] ? Number(rates[key].cost_usd) : null);
  return { rates, get, loaded: rates !== null };
}