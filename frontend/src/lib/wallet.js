import { useEffect, useState } from "react";
import api from "./api";

export function useWallet() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    api.get("/api/wallet/").then((res) => setWallet(res.data)).finally(() => setLoading(false));
  };

  useEffect(refresh, []);
  return { wallet, loading, refresh };
}