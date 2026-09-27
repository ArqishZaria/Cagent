import { useEffect, useRef, useState } from "react";
import api from "./api";

export function useWallet() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = () => {
    setLoading(true);
    api
      .get("/api/wallet/")
      .then((res) => {
        if (mountedRef.current) setWallet(res.data);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { wallet, loading, refresh };
}