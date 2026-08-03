/**
 * AuthContext — global authentication state + axios interceptor.
 *
 * Provides:
 *   - user / token state
 *   - login(), register(), googleLogin(), logout() actions
 *   - Automatically attaches Bearer token to every axios request
 *
 * Session persistence: both the token and user profile are stored in
 * localStorage so a page refresh restores the session immediately without
 * a round-trip. The token's `exp` claim is decoded client-side on startup —
 * if it is expired the session is cleared before the first render completes.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import axios from 'axios';
import apiClient from '../api/client';
import { queryClient } from '../lib/queryClient';
import {
  getRefreshToken as storedGetRefreshToken,
  getToken as storedGetToken,
  setRefreshToken as storeSetRefreshToken,
  setToken as storeSetToken,
} from '../auth/tokenStore';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  auth_provider: string;
  created_at: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  /** True while the initial session restore (validate/refresh) is in flight. */
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  verifyOTP: (email: string, otp: string) => Promise<void>;
  resendOTP: (email: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Decode the JWT payload (no signature verification — server does that). */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp is in seconds; Date.now() is ms
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true; // malformed token → treat as expired
  }
}

/** Read the stored token and return it only if it hasn't expired yet. */
function loadValidToken(): string | null {
  const stored = storedGetToken();
  if (!stored) return null;
  if (isTokenExpired(stored)) {
    storeSetToken(null); // evict expired token immediately
    return null;
  }
  return stored;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USER_KEY = 'nl2sql_user';
const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1`;

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Restore token from localStorage on first render (expired tokens are discarded).
  const [token, setTokenState] = useState<string | null>(loadValidToken);

  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  // On first load we may need to validate the access token or silently refresh
  // it. Gate the router until that settles so a valid (refreshable) session
  // isn't briefly bounced to the login page.
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(
    () => !!storedGetToken() || !!storedGetRefreshToken(),
  );

  // Keep the module-level store and axios header in sync with React state.
  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    storeSetToken(t);
    if (t) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const applyAuthResponse = useCallback(
    (data: { access_token: string; refresh_token?: string; user: AuthUser }) => {
      setToken(data.access_token);
      // Persist the rotating refresh token so the axios interceptor can silently
      // mint new access tokens once the short-lived one expires.
      if (data.refresh_token) {
        storeSetRefreshToken(data.refresh_token);
      }
      setUser(data.user);
    },
    [setToken],
  );

  // On mount: restore the session. If the access token is still valid, validate
  // it with /auth/me. If it is missing/expired but a refresh token exists,
  // silently exchange it for a fresh token pair (keeping the user logged in
  // across the short access-token lifetime). Only clear state when neither works.
  useEffect(() => {
    let cancelled = false;

    const tryRefresh = async (): Promise<boolean> => {
      const refresh = storedGetRefreshToken();
      if (!refresh) return false;
      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
          refresh_token: refresh,
        });
        if (!cancelled) applyAuthResponse(data);
        return true;
      } catch {
        if (!cancelled) {
          setToken(null);
          storeSetRefreshToken(null);
          setUser(null);
        }
        return false;
      }
    };

    const bootstrap = async () => {
      const validAccess = loadValidToken();
      if (validAccess) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${validAccess}`;
        try {
          const { data } = await axios.get<AuthUser>(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${validAccess}` },
          });
          if (!cancelled) setUser(data);
        } catch {
          // Access token rejected — fall back to a refresh before giving up.
          await tryRefresh();
        }
      } else if (storedGetRefreshToken()) {
        await tryRefresh();
      }
      if (!cancelled) setIsBootstrapping(false);
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount only

  // Persist non-sensitive user profile to localStorage for instant restore on reload.
  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE}/auth/login`, { email, password });
      // Wipe any cached data from a previous account signed into this tab
      // (chats, dashboards, schedules, metrics, templates...) before the new
      // user's queries mount — otherwise stale cross-account data can paint.
      queryClient.clear();
      applyAuthResponse(data);
    } finally {
      setIsLoading(false);
    }
  }, [applyAuthResponse]);

  const register = useCallback(async (email: string, password: string, fullName?: string) => {
    setIsLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/register`, {
        email,
        password,
        full_name: fullName ?? null,
      });
      // Do not applyAuthResponse here because it's a 202 with no token.
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyOTP = useCallback(async (email: string, otp: string) => {
    setIsLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE}/auth/verify-otp`, { email, otp_code: otp });
      queryClient.clear();
      applyAuthResponse(data);
    } finally {
      setIsLoading(false);
    }
  }, [applyAuthResponse]);

  const resendOTP = useCallback(async (email: string) => {
    setIsLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/resend-otp`, { email });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const googleLogin = useCallback(async (credential: string) => {
    setIsLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE}/auth/google`, { credential });
      queryClient.clear();
      applyAuthResponse(data);
    } finally {
      setIsLoading(false);
    }
  }, [applyAuthResponse]);

  const logout = useCallback(async () => {
    try {
      // Revokes the current login session server-side (identified by the JWT's
      // sid), which also hard-revokes the refresh tokens bound to it.
      await apiClient.post('/auth/logout');
    } catch {
      // ignore — we're logging out regardless
    }
    setToken(null);
    storeSetRefreshToken(null);
    setUser(null);
    // Drop every cached query so the next account signed into this tab never
    // renders this session's chats/dashboards/schedules/metrics/templates.
    queryClient.clear();
  }, [setToken]);

  // ── Value ─────────────────────────────────────────────────────────────────

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    isLoading,
    isBootstrapping,
    isAuthenticated: !!token && !!user,
    login,
    register,
    verifyOTP,
    resendOTP,
    googleLogin,
    logout,
  }), [user, token, isLoading, isBootstrapping, login, register, verifyOTP, resendOTP, googleLogin, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
