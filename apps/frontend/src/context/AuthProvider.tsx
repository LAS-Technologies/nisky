"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, refreshAccessToken, setAccessToken } from "@/lib/api";
import type { AuthResponse, User } from "@/types/entities";

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (result: { accessToken: string; user: User }) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasSession = useRef(false);
  const restorePromise = useRef<Promise<AuthResponse | null> | null>(null);

  const setAuth = useCallback((result: { accessToken: string; user: User }) => {
    hasSession.current = true;
    setAccessToken(result.accessToken);
    setToken(result.accessToken);
    setUser(result.user);
    setIsLoading(false);
  }, []);

  const clearSession = useCallback(() => {
    hasSession.current = false;
    setAccessToken(null);
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch { /* logout is idempotent */ }
    clearSession();
    router.replace("/login");
  }, [router, clearSession]);

  useEffect(() => {
    const onRefreshed = (event: Event) => {
      const result = (event as CustomEvent<{ accessToken: string; user: User }>).detail;
      if (result?.accessToken && result.user) setAuth(result);
    };
    const onLogout = () => {
      clearSession();
      setIsLoading(false);
      if (pathname.startsWith("/invite/")) return;
      const oauthReturn = pathname === "/oauth/authorize" && typeof window !== "undefined"
        ? `${pathname}${window.location.search}`
        : null;
      router.replace(oauthReturn ? `/login?redirect=${encodeURIComponent(oauthReturn)}` : "/login?expired=1");
    };
    window.addEventListener("auth:refreshed", onRefreshed);
    window.addEventListener("auth:logout", onLogout);
    return () => {
      window.removeEventListener("auth:refreshed", onRefreshed);
      window.removeEventListener("auth:logout", onLogout);
    };
  }, [router, pathname, setAuth, clearSession]);

  useEffect(() => {
    const isAuthPath = pathname === "/login" || pathname === "/register";
    if (isAuthPath || hasSession.current) {
      setIsLoading(false);
      return;
    }

    restorePromise.current ??= refreshAccessToken();
    let active = true;
    void restorePromise.current.then((result) => {
      if (!active) return;
      if (result) setAuth(result);
      setIsLoading(false);
    });
    return () => { active = false; };
  }, [pathname, setAuth]);

  return (
    <AuthContext.Provider value={{ user, accessToken, isAuthenticated: Boolean(user && accessToken), isLoading, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
