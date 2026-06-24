/**
 * localStorage-backed JWT token store.
 *
 * Persists the access token across page refreshes so the user stays logged in.
 * Callers outside React (e.g. fetch-based streaming APIs) use getToken().
 */
const TOKEN_KEY = 'nl2sql_token';

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

export { TOKEN_KEY };
