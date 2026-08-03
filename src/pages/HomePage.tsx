/**
 * HomePage — workspace landing page (replaces the old "Query is home" default).
 *
 * Built entirely from data the app already exposes (usage, connections,
 * dashboards, schedules, metrics, templates, saved queries, sessions,
 * members, health) — no new backend endpoints. Sections: welcome header,
 * quick stats, recent activity, quick actions, continue working, insights.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Sparkles,
  Database,
  Clock3,
  LayoutDashboard,
  SquarePen,
  CalendarClock,
  Upload,
  BadgeCheck,
  FileCode2,
  MoreHorizontal,
  MessagesSquare,
  PlugZap,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Bookmark,
} from 'lucide-react';
import {
  getUsage,
  getDashboards,
  getSchedules,
  getMetrics,
  getTemplates,
  getSavedQueries,
  getSessions,
  checkHealth,
  type Schedule,
  type Metric,
  type DashboardSummary,
  type QueryTemplate,
} from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useConnections } from '@/context/ConnectionContext';
import { useCommandPalette } from '@/context/CommandPaletteContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface SavedQueryLite {
  id: number;
  title: string | null;
  nl_prompt: string;
  updated_at: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface ActivityItem {
  key: string;
  icon: typeof MessagesSquare;
  text: string;
  time: string;
  timestamp: number;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { connections, activeConnection } = useConnections();
  const { openPalette } = useCommandPalette();

  const { data: usage } = useQuery({
    queryKey: ['usage', 'today'],
    queryFn: () => getUsage('today'),
  });

  const { data: isHealthy = true } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    staleTime: 20_000,
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', 'recent'],
    queryFn: () => getSessions(50, 0),
    enabled: !!user,
  });

  const { data: dashboardsData, isLoading: dashboardsLoading } = useQuery({
    queryKey: ['dashboards', 'home'],
    queryFn: () => getDashboards({ limit: 5, offset: 0 }),
  });

  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules', 'home'],
    queryFn: () => getSchedules(),
  });

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics', 'home'],
    queryFn: () => getMetrics({ limit: 5 }),
  });

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['templates', 'home'],
    queryFn: () => getTemplates({ limit: 4 }),
  });

  const { data: savedQueriesData, isLoading: savedLoading } = useQuery({
    queryKey: ['saved-queries', 'home'],
    queryFn: () => getSavedQueries({ limit: 4 }) as Promise<{ items: SavedQueryLite[]; total: number }>,
  });

  const schedules: Schedule[] = schedulesData?.items ?? [];
  const metrics: Metric[] = metricsData?.items ?? [];
  const dashboards: DashboardSummary[] = dashboardsData?.items ?? [];
  const templates: QueryTemplate[] = templatesData?.items ?? [];
  const savedQueries: SavedQueryLite[] = savedQueriesData?.items ?? [];

  const firstName = useMemo(() => {
    const source = user?.full_name?.trim() || user?.email || 'there';
    return source.split(/[\s@]/)[0];
  }, [user]);

  // ── Recent activity: merge sessions, dashboards & schedule runs into one timeline ──
  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    for (const s of sessionsData?.sessions ?? []) {
      const ts = s.updated_at ?? s.created_at;
      if (!ts) continue;
      items.push({
        key: `session-${s.id}`,
        icon: MessagesSquare,
        text: `Asked “${s.title ?? 'New chat'}”`,
        time: timeAgo(ts),
        timestamp: new Date(ts).getTime(),
      });
    }
    for (const d of dashboards) {
      items.push({
        key: `dash-${d.id}`,
        icon: LayoutDashboard,
        text: `Updated dashboard “${d.name}”`,
        time: timeAgo(d.updated_at),
        timestamp: new Date(d.updated_at).getTime(),
      });
    }
    for (const s of schedules) {
      if (!s.last_run_at) continue;
      items.push({
        key: `sched-${s.id}`,
        icon: Clock3,
        text: `Schedule “${s.name}” ran ${s.last_status === 'failed' ? 'and failed' : 'successfully'}`,
        time: timeAgo(s.last_run_at),
        timestamp: new Date(s.last_run_at).getTime(),
      });
    }
    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 7);
  }, [sessionsData, dashboards, schedules]);

  // ── Insights & recommendations — derived from real, already-fetched state ──
  const insights = useMemo(() => {
    const list: { id: string; tone: 'warning' | 'info'; icon: typeof AlertTriangle; text: string; cta?: { label: string; to: string } }[] = [];

    if (!isHealthy) {
      list.push({
        id: 'health',
        tone: 'warning',
        icon: AlertTriangle,
        text: 'Backend is unreachable right now — queries may fail until it reconnects.',
      });
    }
    if (connections.length === 0) {
      list.push({
        id: 'no-connection',
        tone: 'info',
        icon: PlugZap,
        text: 'Connect a database to start asking questions about your data.',
        cta: { label: 'Add a connection', to: '/schema' },
      });
    }
    const failingSchedules = schedules.filter((s) => s.consecutive_failures > 0);
    if (failingSchedules.length > 0) {
      list.push({
        id: 'failing-schedules',
        tone: 'warning',
        icon: AlertTriangle,
        text: `${failingSchedules.length} scheduled quer${failingSchedules.length === 1 ? 'y is' : 'ies are'} failing — the last run didn't complete successfully.`,
        cta: { label: 'Review schedules', to: '/schedules' },
      });
    }
    const uncertified = metrics.filter((m) => !m.certified);
    if (uncertified.length > 0) {
      list.push({
        id: 'uncertified-metrics',
        tone: 'info',
        icon: BadgeCheck,
        text: `${uncertified.length} metric${uncertified.length === 1 ? '' : 's'} awaiting certification.`,
        cta: { label: 'Review metrics', to: '/metrics' },
      });
    }
    if (!dashboardsLoading && dashboards.length === 0) {
      list.push({
        id: 'no-dashboards',
        tone: 'info',
        icon: LayoutDashboard,
        text: "You haven't created a dashboard yet — turn a favorite query into a chart.",
        cta: { label: 'Create a dashboard', to: '/dashboards' },
      });
    }
    return list;
  }, [isHealthy, connections.length, schedules, metrics, dashboards, dashboardsLoading]);

  const activeSchedulesCount = schedules.filter((s) => !s.is_paused).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
      {/* ── Welcome header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold tracking-tight text-foreground md:text-[28px]">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {activeConnection && (
              <span className="inline-flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" /> {activeConnection.name}
              </span>
            )}
            {!activeConnection && (
              <span className="inline-flex items-center gap-1.5 text-amber-400/90">
                <PlugZap className="h-3.5 w-3.5" /> No database connected
              </span>
            )}
          </p>
        </div>

        <button
          onClick={openPalette}
          className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-foreground/[0.02] px-4 py-2.5 text-left text-sm text-muted-foreground/70 transition-colors hover:bg-foreground/[0.05] hover:text-foreground md:w-80"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1">Search anything…</span>
          <kbd className="shrink-0 rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* ── Quick stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Sparkles} label="Queries today" value={usage?.queries_used} />
        <StatCard icon={Database} label="Connections" value={connections.length} />
        <StatCard icon={Clock3} label="Active schedules" value={activeSchedulesCount} loading={schedulesLoading} />
        <StatCard icon={LayoutDashboard} label="Dashboards" value={dashboardsData?.total} loading={dashboardsLoading} />
      </div>

      {/* ── Quick actions — a slim row, not another card ─────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => navigate('/query', { state: { newChat: true } })}>
          <SquarePen /> New query
        </Button>
        <Button variant="secondary" onClick={() => navigate('/dashboards')}>
          <LayoutDashboard /> Dashboard
        </Button>
        <Button variant="secondary" onClick={() => navigate('/schedules')}>
          <CalendarClock /> Schedule
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg border border-border bg-foreground/[0.02] px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" /> More
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onClick={() => navigate('/schema')}>
              <span className="flex items-center gap-2"><PlugZap className="h-3.5 w-3.5" /> Add database</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/schema')}>
              <span className="flex items-center gap-2"><Upload className="h-3.5 w-3.5" /> Upload schema</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/metrics')}>
              <span className="flex items-center gap-2"><BadgeCheck className="h-3.5 w-3.5" /> Create metric</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/templates')}>
              <span className="flex items-center gap-2"><FileCode2 className="h-3.5 w-3.5" /> New template</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Recent activity + Insights — side by side, equal width ───────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {sessionsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full rounded-lg" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <EmptyRow text="No activity yet — run a query to get started." />
            ) : (
              <ul className="space-y-0.5">
                {activity.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.key} className="flex min-w-0 items-start gap-2.5 rounded-lg px-1.5 py-2 text-sm">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                      <span className="min-w-0 flex-1 truncate text-foreground/85">{item.text}</span>
                      <span className="shrink-0 text-xs text-muted-foreground/50">{item.time}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Insights &amp; recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0">
            {insights.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-foreground/[0.02] px-3 py-3 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                You're all caught up — nothing needs attention.
              </div>
            ) : (
              insights.map((insight) => {
                const Icon = insight.icon;
                return (
                  <div
                    key={insight.id}
                    className={cn(
                      'flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-sm',
                      insight.tone === 'warning'
                        ? 'border-warning-border bg-warning-bg text-warning-text'
                        : 'border-info-border bg-info-bg text-info-text',
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1">{insight.text}</span>
                    </div>
                    {insight.cta && (
                      <button
                        onClick={() => navigate(insight.cta!.to)}
                        className="ml-6 inline-flex w-fit items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
                      >
                        {insight.cta.label} <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Continue working — full width, one row of columns ────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Continue working</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 pt-0 sm:grid-cols-2 lg:grid-cols-4">
          <ContinueColumn
            title="Dashboards"
            icon={LayoutDashboard}
            loading={dashboardsLoading}
            items={dashboards.slice(0, 4).map((d) => ({ key: d.id, label: d.name, meta: timeAgo(d.updated_at) }))}
            viewAllTo="/dashboards"
            onNavigate={navigate}
          />
          <ContinueColumn
            title="Saved queries"
            icon={Bookmark}
            loading={savedLoading}
            items={savedQueries.slice(0, 4).map((q) => ({ key: q.id, label: q.title ?? q.nl_prompt, meta: timeAgo(q.updated_at) }))}
            viewAllTo="/saved"
            onNavigate={navigate}
          />
          <ContinueColumn
            title="Metrics"
            icon={BadgeCheck}
            loading={metricsLoading}
            items={metrics.slice(0, 4).map((m) => ({ key: m.metric_id, label: m.name, meta: m.certified ? 'Certified' : 'Draft' }))}
            viewAllTo="/metrics"
            onNavigate={navigate}
          />
          <ContinueColumn
            title="Templates"
            icon={FileCode2}
            loading={templatesLoading}
            items={templates.slice(0, 4).map((t) => ({ key: t.id, label: t.name, meta: '' }))}
            viewAllTo="/templates"
            onNavigate={navigate}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: typeof Database;
  label: string;
  value: number | undefined;
  loading?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground/70">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      {loading || value === undefined ? (
        <Skeleton className="mt-2 h-7 w-12 rounded-md" />
      ) : (
        <p className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">{value}</p>
      )}
    </Card>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-1.5 py-4 text-sm text-muted-foreground/60">{text}</p>;
}

function ContinueColumn({
  title,
  icon: Icon,
  items,
  loading,
  viewAllTo,
  onNavigate,
}: {
  title: string;
  icon: typeof Database;
  items: { key: string | number; label: string; meta: string }[];
  loading: boolean;
  viewAllTo: string;
  onNavigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{title}</span>
        </p>
        <button
          onClick={() => onNavigate(viewAllTo)}
          className="flex shrink-0 items-center text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          View all <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground/50">Nothing here yet.</p>
      ) : (
        <div className="space-y-0.5">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(viewAllTo)}
              className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-foreground/[0.04]"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-foreground/85">{item.label}</span>
              {item.meta && (
                <Badge variant="secondary" className="shrink-0 text-[10px] normal-case tracking-normal">
                  {item.meta}
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
