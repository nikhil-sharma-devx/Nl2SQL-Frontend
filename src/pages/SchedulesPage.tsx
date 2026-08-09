import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSchedules,
  createSchedule,
  deleteSchedule,
  pauseSchedule,
  resumeSchedule,
  runScheduleNow,
  getScheduleHistory,
  handleApiError,
  type Schedule,
  type ScheduleListResponse,
  type ScheduleHistoryResponse,
} from '../api/client';
import { useConnections } from '../context/ConnectionContext';
import { toast } from '../components/ui/toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ItemActionsMenu } from '@/components/ItemActionsMenu';
import {
  Clock3,
  Plus,
  Play,
  Pause,
  Trash2,
  Loader2,
  History,
  Mail,
  ChevronUp,
  X,
} from 'lucide-react';

const NOTIFY_CONDITIONS = [
  { value: 'always', label: 'Every run' },
  { value: 'on_results', label: 'Only when there are results' },
  { value: 'on_change', label: 'Only when results change' },
] as const;

function statusBadge(schedule: Schedule): { label: string; variant: 'secondary' | 'destructive' | 'default' } {
  if (schedule.is_paused) return { label: 'Paused', variant: 'secondary' };
  if (schedule.last_status === 'failed' || schedule.last_status === 'timeout') {
    return { label: 'Failing', variant: 'destructive' };
  }
  if (schedule.last_status === 'success') return { label: 'Healthy', variant: 'default' };
  return { label: 'Pending first run', variant: 'secondary' };
}

function HistoryPanel({ scheduleId }: { scheduleId: string }) {
  const { data, isLoading } = useQuery<ScheduleHistoryResponse>({
    queryKey: ['schedule-history', scheduleId],
    queryFn: () => getScheduleHistory(scheduleId, { limit: 10 }),
  });

  if (isLoading) return <Skeleton className="h-16 w-full rounded-lg" />;
  const runs = data?.items ?? [];
  if (runs.length === 0) {
    return <p className="py-3 text-xs text-muted-foreground/70">No runs yet.</p>;
  }
  return (
    <div className="space-y-1.5 py-2">
      {runs.map((run) => (
        <div
          key={run.id}
          className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-1.5 text-xs"
        >
          <span
            className={
              run.status === 'success'
                ? 'text-primary'
                : run.status === 'failed' || run.status === 'timeout'
                ? 'text-destructive'
                : 'text-muted-foreground'
            }
          >
            {run.status}
          </span>
          <span className="text-muted-foreground">{new Date(run.started_at).toLocaleString()}</span>
          <span className="text-muted-foreground">{run.row_count ?? 0} row(s)</span>
          {run.error && <span className="truncate text-destructive" title={run.error}>{run.error}</span>}
        </div>
      ))}
    </div>
  );
}

export default function SchedulesPage() {
  const queryClient = useQueryClient();
  const { connections, activeConnectionId } = useConnections();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [nlPrompt, setNlPrompt] = useState('');
  const [scheduleText, setScheduleText] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [notifyCondition, setNotifyCondition] = useState<'always' | 'on_results' | 'on_change'>('always');

  const { data, isLoading } = useQuery<ScheduleListResponse>({
    queryKey: ['schedules'],
    queryFn: () => getSchedules(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['schedules'] });

  const createMutation = useMutation({
    mutationFn: () =>
      createSchedule({
        connection_id: connectionId || activeConnectionId || '',
        name,
        nl_prompt: nlPrompt,
        schedule_text: scheduleText,
        notify_condition: notifyCondition,
      }),
    onSuccess: () => {
      invalidate();
      setName('');
      setNlPrompt('');
      setScheduleText('');
      setNotifyCondition('always');
      setShowCreate(false);
      toast({ title: 'Schedule created', variant: 'success' });
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => {
      invalidate();
      setDeleteConfirmId(null);
      toast({ title: 'Schedule deleted', variant: 'success' });
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => pauseSchedule(id),
    onSuccess: invalidate,
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => resumeSchedule(id),
    onSuccess: invalidate,
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const runNowMutation = useMutation({
    mutationFn: (id: string) => runScheduleNow(id),
    onSuccess: (run, id) => {
      queryClient.invalidateQueries({ queryKey: ['schedule-history', id] });
      invalidate();
      toast({
        title: run.status === 'success' ? `Ran successfully — ${run.row_count ?? 0} row(s)` : `Run ${run.status}`,
        variant: run.status === 'success' ? 'success' : 'error',
      });
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const items = data?.items ?? [];
  const canCreate = name.trim() && nlPrompt.trim() && scheduleText.trim() && (connectionId || activeConnectionId);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Scheduled Queries</h1>
          <p className="mt-1 text-muted-foreground">Run a saved question on a recurring schedule and get alerted.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" />
          New schedule
        </Button>
      </div>

      {showCreate && (
        <div className="glass-card space-y-3 rounded-xl p-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Schedule name…" />
          <Input
            value={nlPrompt}
            onChange={(e) => setNlPrompt(e.target.value)}
            placeholder="What question should run? e.g. total revenue by day"
          />
          <Input
            value={scheduleText}
            onChange={(e) => setScheduleText(e.target.value)}
            placeholder="When? e.g. every morning, daily at 9am, every Monday"
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={connectionId || activeConnectionId || ''}
              onChange={(e) => setConnectionId(e.target.value)}
              className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              {connections.map((c) => (
                <option key={c.connection_id} value={c.connection_id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={notifyCondition}
              onChange={(e) => setNotifyCondition(e.target.value as typeof notifyCondition)}
              className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              {NOTIFY_CONDITIONS.map((n) => (
                <option key={n.value} value={n.value}>
                  Email me: {n.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={!canCreate || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <Clock3 className="h-7 w-7 text-primary" />
          </div>
          <p className="font-medium text-foreground">No scheduled queries yet</p>
          <p className="mt-1 text-sm text-muted-foreground/70">Create one above to get results emailed to you on a cadence.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => {
            const badge = statusBadge(s);
            const expanded = expandedId === s.id;
            return (
              <div key={s.id} className="glass-card card-lift rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground">{s.name}</p>
                      {s.is_builtin && (
                        <Badge variant="secondary" className="normal-case tracking-normal">Example</Badge>
                      )}
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {s.notify_email && <Mail className="h-3.5 w-3.5 text-muted-foreground/60" />}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {s.raw_schedule_text ?? s.cron_expr} · "{s.nl_prompt}"
                    </p>
                    {s.next_run_at && !s.is_paused && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                        Next run: {new Date(s.next_run_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => runNowMutation.mutate(s.id)}
                      disabled={runNowMutation.isPending}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-primary"
                      title="Run now"
                    >
                      {runNowMutation.isPending && runNowMutation.variables === s.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => (s.is_paused ? resumeMutation.mutate(s.id) : pauseMutation.mutate(s.id))}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-primary"
                      title={s.is_paused ? 'Resume' : 'Pause'}
                    >
                      {s.is_paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </button>
                    {deleteConfirmId === s.id ? (
                      <>
                        <button
                          onClick={() => deleteMutation.mutate(s.id)}
                          className="rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          Confirm delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <ItemActionsMenu
                        actions={[
                          {
                            key: 'history',
                            label: expanded ? 'Hide history' : 'View history',
                            icon: expanded ? ChevronUp : History,
                            onClick: () => setExpandedId(expanded ? null : s.id),
                          },
                          {
                            key: 'delete',
                            label: 'Delete',
                            icon: Trash2,
                            destructive: true,
                            onClick: () => setDeleteConfirmId(s.id),
                          },
                        ]}
                      />
                    )}
                  </div>
                </div>
                {expanded && (
                  <div className="mt-2 border-t border-border/50">
                    <HistoryPanel scheduleId={s.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
