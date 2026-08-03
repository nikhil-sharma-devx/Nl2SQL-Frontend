import { QueryClient } from '@tanstack/react-query';

/**
 * Single app-wide QueryClient instance, shared with AuthContext so it can be
 * cleared on login/logout/register — otherwise cached data from a previous
 * account's session (chats, dashboards, schedules, metrics, templates...)
 * stays in memory and renders under the next account signed into the same tab.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});
