"use client";

import { account, createAppwriteJWT, isAppwriteConfigured } from "@/lib/appwrite";
import { ID, type Models } from "appwrite";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PlayerStats = {
  games: number;
  wins: number;
  losses: number;
};

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: Models.User<Models.Preferences> | null;
  stats: PlayerStats | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshStats: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isAppwriteConfigured);
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);

  const refreshStats = useCallback(async () => {
    if (!isAppwriteConfigured) return;

    const jwt = await createAppwriteJWT();
    const response = await fetch("/api/stats", {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Could not load stats");
    }

    setStats((await response.json()) as PlayerStats);
  }, []);

  const loadUser = useCallback(async () => {
    if (!isAppwriteConfigured) return;

    try {
      const currentUser = await account.get();
      setUser(currentUser);
      await refreshStats().catch(() => setStats(null));
    } catch {
      setUser(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [refreshStats]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadUser(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    await account.createEmailPasswordSession({ email, password });
    await loadUser();
  }, [loadUser]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    await account.create({
      userId: ID.unique(),
      email,
      password,
      name: name.trim(),
    });
    await account.createEmailPasswordSession({ email, password });
    await loadUser();
  }, [loadUser]);

  const signOut = useCallback(async () => {
    await account.deleteSession({ sessionId: "current" });
    setUser(null);
    setStats(null);
  }, []);

  const value = useMemo(() => ({
    configured: isAppwriteConfigured,
    loading,
    user,
    stats,
    signIn,
    signUp,
    signOut,
    refreshStats,
  }), [loading, refreshStats, signIn, signOut, signUp, stats, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
