/**
 * useRecentSessions — shared recent-chat-sessions poll.
 *
 * Layout mounts for the entire authenticated session, so this hook is the one
 * place that owns the 30s heartbeat; other consumers (e.g. HomePage) read the
 * same ['sessions','recent'] cache entry instead of registering a second query
 * with its own options, which would otherwise fight the heartbeat over
 * staleness/retry behavior without adding a second network request.
 */
import { useQuery } from '@tanstack/react-query';
import { getSessions, type SessionListResponse } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function useRecentSessions() {
  const { user } = useAuth();
  return useQuery<SessionListResponse>({
    queryKey: ['sessions', 'recent'],
    queryFn: () => getSessions(50, 0),
    refetchInterval: 30_000,
    enabled: !!user,
    retry: false,
  });
}
