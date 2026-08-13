import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient, { changePassword } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import { FormMessage } from '../../components/ui/form-message';
import { handleApiError } from '../../api/client';

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

function ChangePasswordSection() {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPw, newPw),
    onSuccess: (data) => {
      setStatus('success');
      setMessage(data.message);
      setCurrentPw('');
      setNewPw('');
      setTimeout(() => setStatus('idle'), 4000);
    },
    onError: (err) => {
      setStatus('error');
      setMessage(handleApiError(err));
    },
  });

  const canSubmit = currentPw.length > 0 && newPw.length >= 8;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Change Password</h3>
      <div className="max-w-sm space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="current-pw">Current Password</Label>
          <Input
            id="current-pw"
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-pw">New Password</Label>
          <Input
            id="new-pw"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
            placeholder="Min 8 characters"
          />
        </div>
        {status === 'success' && <p className="text-sm text-primary">{message}</p>}
        <FormMessage>{status === 'error' ? message : ''}</FormMessage>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
          size="sm"
        >
          {mutation.isPending ? 'Updating…' : 'Update Password'}
        </Button>
      </div>
    </section>
  );
}

export default function SecuritySettings() {
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
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
      await logout();
      navigate('/auth');
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Change Password — only for email/password accounts */}
      {user?.auth_provider === 'email' && (
        <>
          <ChangePasswordSection />
          <Separator />
        </>
      )}

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
