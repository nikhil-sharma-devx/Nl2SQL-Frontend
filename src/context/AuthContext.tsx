/**
 * AuthContext — global authentication state + axios interceptor.
 *
 * Provides:
 *   - user / token state
 *   - login(), register(), googleLogin(), logout() actions
 *   - Automatically attaches Bearer token to every axios request
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

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'nl2sql_token';
const USER_KEY  = 'nl2sql_user';
const _origin   = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const API_BASE  = `${_origin}/api/v1`;

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser]   = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  // ── Persist + axios interceptor ──────────────────────────────────────────

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      localStorage.removeItem(TOKEN_KEY);
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

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
    // Immediately set for the current request cycle
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
  }, []);

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
  }, []);

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
