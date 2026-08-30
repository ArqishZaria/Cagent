import { useEffect, useState } from "react";
import api from "./api";

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    api.get("/api/users/profile/").then((res) => setUser(res.data)).finally(() => setLoading(false));
  };

  useEffect(refresh, []);
  return { user, loading, refresh, isAdmin: user?.role === "ADMIN" };
}