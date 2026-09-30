import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { unwrap, unwrapError } from "./api";
import { _resetCollapsibleCache } from "@/components/shared/CollapsibleSection";

const AuthContext = createContext(null);
// FE-06: session tokens live in httpOnly cookies; clear any legacy copies left in localStorage
const LEGACY_KEYS = ["aurora_access_token", "aurora_refresh_token", "aurora_token", "token"];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    api
      .get("/auth/me", { _skipAuthRedirect: true })
      .then((res) => setUser(unwrap(res)))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", null, { _skipAuthRedirect: true });
    } catch (e) {
      // ignore
    }
    _resetCollapsibleCache();
    setUser(null);
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      _resetCollapsibleCache();
      const res = await api.post("/auth/login", { email, password });
      const data = unwrap(res);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: unwrapError(e) };
    }
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(unwrap(res));
    } catch (e) {
      // ignore
    }
  }, []);

  const can = useCallback(
    (perm) => {
      if (!user) return false;
      const perms = user.permissions || [];
      if (perms.includes("*")) return true;
      return perms.includes(perm);
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshMe, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
