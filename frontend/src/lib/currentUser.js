import { useEffect, useRef, useState } from "react";
import api from "./api";

export function useCurrentUser() {
  const [user, setUser] = useState(null);
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
      .get("/api/users/profile/")
      .then((res) => {
        if (mountedRef.current) setUser(res.data);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading, refresh, isAdmin: user?.role === "ADMIN" };
}