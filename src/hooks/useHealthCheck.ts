/**
 * useHealthCheck — shared backend-health poll.
 *
 * Layout mounts for the entire authenticated session, so this hook is the one
 * place that owns the 30s heartbeat; other consumers (e.g. HomePage) read the
 * same ['health'] cache entry instead of registering a second query with its
 * own options, which would otherwise fight the heartbeat over staleness/retry
 * behavior without adding a second network request.
 */
import { useQuery } from '@tanstack/react-query';
import { checkHealth } from '../api/client';

export function useHealthCheck() {
  const { data: isHealthy = true } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    refetchInterval: 30_000,
    retry: false,
    staleTime: 20_000,
  });
  return isHealthy;
}
