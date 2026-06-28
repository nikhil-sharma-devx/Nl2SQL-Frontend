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
import { getToken as storedGetToken, setToken as storeSetToken } from '../auth/tokenStore';

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

  // On mount: if we restored a token from localStorage, wire the axios header
  // and silently validate it with the server. If the server rejects it (e.g.
  // the user was deactivated or the secret was rotated), clear the session.
  useEffect(() => {
    if (!token) return;

    // Prime the axios header so the first API call in any component works.
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Silent server-side validation — refresh user profile at the same time.
    axios
      .get<AuthUser>(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        setUser(data);
      })
      .catch(() => {
        // Token was rejected (expired, revoked, or rotated secret) → log out.
        setToken(null);
        setUser(null);
      });
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  const applyAuthResponse = useCallback((data: { access_token: string; user: AuthUser }) => {
    setToken(data.access_token);
    setUser(data.user);
  }, [setToken]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE}/auth/login`, { email, password });
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
      applyAuthResponse(data);
    } finally {
      setIsLoading(false);
    }
  }, [applyAuthResponse]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore — we're logging out regardless
    }
    setToken(null);
    setUser(null);
  }, [setToken]);

  // ── Value ─────────────────────────────────────────────────────────────────

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    verifyOTP,
    resendOTP,
    googleLogin,
    logout,
  }), [user, token, isLoading, login, register, verifyOTP, resendOTP, googleLogin, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
