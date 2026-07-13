/**
 * localStorage-backed JWT token store.
 *
 * Persists the short-lived access token and the long-lived refresh token across
 * page refreshes so the user stays logged in. Callers outside React (e.g. the
 * axios interceptor and fetch-based streaming APIs) use getToken() /
 * getRefreshToken().
 */
const TOKEN_KEY = 'nl2sql_token';
const REFRESH_TOKEN_KEY = 'nl2sql_refresh_token';

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (t: string | null): void => {
  try {
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors (private browsing, storage quota exceeded, etc.)
  }
};

export const getRefreshToken = (): string | null => {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setRefreshToken = (t: string | null): void => {
  try {
    if (t) {
      localStorage.setItem(REFRESH_TOKEN_KEY, t);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors.
  }
};

/** Clear both the access and refresh tokens (full local sign-out). */
export const clearTokens = (): void => {
  setToken(null);
  setRefreshToken(null);
};

export { TOKEN_KEY, REFRESH_TOKEN_KEY };
