import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';

interface LoginSession {
  id: string;
  device: string | null;
  browser: string | null;
  ip: string | null;
  last_active_at: string;
  created_at: string;
  current: boolean;
}

interface LoginActivity {
  ip: string | null;
  user_agent: string | null;
  outcome: string;
  created_at: string;
}

export default function SecuritySettings() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery<{ items: LoginSession[] }>({
    queryKey: ['auth-sessions'],
    queryFn: () => apiClient.get('/auth-sessions').then(r => r.data),
  });

  const { data: activityData, isLoading: activityLoading } = useQuery<{ items: LoginActivity[] }>({
    queryKey: ['login-activity'],
    queryFn: () => apiClient.get('/login-activity', { params: { limit: 20 } }).then(r => r.data),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/auth-sessions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth-sessions'] }),
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => apiClient.delete('/auth-sessions').then(r => r.data),
    onSuccess: async () => {
      // Current session is also revoked — log out completely
      await logout();
      navigate('/auth');
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Active Sessions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Active Sessions</h3>
          {(sessionsData?.items?.length ?? 0) > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => revokeAllMutation.mutate()}
              disabled={revokeAllMutation.isPending}
            >
              Revoke All
            </Button>
          )}
        </div>

        {sessionsLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (sessionsData?.items?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions found.</p>
        ) : (
          <div className="space-y-2">
            {sessionsData?.items.map(s => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-3 py-2.5"
              >
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    {s.device ?? 'Unknown device'} · {s.browser ?? 'Unknown browser'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.ip ?? 'Unknown IP'} · Last active {new Date(s.last_active_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => revokeMutation.mutate(s.id)}
                  disabled={revokeMutation.isPending}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Login Activity */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Login Activity</h3>

        {activityLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (activityData?.items?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No login events recorded.</p>
        ) : (
          <div className="space-y-1.5">
            {activityData?.items.map((e, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-foreground/[0.03]"
              >
                <div>
                  <p className="text-foreground">{e.ip ?? 'Unknown IP'}</p>
                  <p className="max-w-xs truncate text-xs text-muted-foreground">
                    {e.user_agent ?? 'Unknown agent'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={e.outcome === 'success' ? 'default' : 'destructive'}>
                    {e.outcome}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
