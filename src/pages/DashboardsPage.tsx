import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDashboards,
  getDashboard,
  createDashboard,
  renameDashboard,
  duplicateDashboard,
  deleteDashboard,
  refreshDashboard,
  updateDashboardWidget,
  deleteDashboardWidget,
  handleApiError,
  type DashboardListResponse,
  type Dashboard,
  type WidgetRefreshResult,
} from '../api/client';
import { toast } from '../components/ui/toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ItemActionsMenu } from '@/components/ItemActionsMenu';
import DataChart from '../components/DataChart';
import { recommendChart, columnsFromRow, type ChartType } from '../utils/chart';
import { LayoutDashboard, Plus, RefreshCw, Copy, Trash2, Pencil, ArrowLeft, Loader2, Check, X } from 'lucide-react';

// Only the chart types DataChart can actually render (map has no renderer yet).
const CHART_TYPES: ChartType[] = ['table', 'bar', 'line', 'pie', 'scatter', 'histogram', 'kpi'];

/** Config passed to DataChart, derived from a widget + its (optional) fresh rows. */
function widgetChartConfig(
  chartType: string,
  storedConfig: Record<string, unknown> | null,
  rows: Record<string, unknown>[],
): { type: string; x_axis: string; y_axis: string } {
  const cfg = (storedConfig ?? {}) as { x_axis?: string; y_axis?: string };
  let x = cfg.x_axis ?? '';
  let y = cfg.y_axis ?? '';
  if ((!x || !y) && rows.length > 0) {
    const rec = recommendChart(columnsFromRow(rows[0]), rows);
    x = x || rec.x_axis || '';
    y = y || rec.y_axis || '';
  }
  return { type: chartType, x_axis: x, y_axis: y };
}

// ── Dashboard detail view ────────────────────────────────────────────────────

function DashboardDetail({ dashboardId, onBack }: { dashboardId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [refreshData, setRefreshData] = useState<Record<string, WidgetRefreshResult>>({});
  const [deleteWidgetConfirmId, setDeleteWidgetConfirmId] = useState<string | null>(null);

  const dashKey = ['dashboard', dashboardId] as const;

  const { data: dashboard, isLoading } = useQuery<Dashboard>({
    queryKey: dashKey,
    queryFn: () => getDashboard(dashboardId),
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshDashboard(dashboardId),
    onSuccess: (res) => {
      const map: Record<string, WidgetRefreshResult> = {};
      for (const w of res.widgets) map[w.widget_id] = w;
      setRefreshData(map);
      const failed = res.widgets.filter((w) => w.error).length;
      toast({
        title: failed ? `Refreshed with ${failed} widget error${failed > 1 ? 's' : ''}` : 'Dashboard refreshed',
        variant: failed ? 'error' : 'success',
      });
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => renameDashboard(dashboardId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashKey });
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      setEditingName(false);
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const chartTypeMutation = useMutation({
    mutationFn: ({ widgetId, chartType }: { widgetId: string; chartType: string }) =>
      updateDashboardWidget(dashboardId, widgetId, { chart_type: chartType }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dashKey }),
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const deleteWidgetMutation = useMutation({
    mutationFn: (widgetId: string) => deleteDashboardWidget(dashboardId, widgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashKey });
      setDeleteWidgetConfirmId(null);
      toast({ title: 'Widget removed', variant: 'success' });
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  if (isLoading || !dashboard) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="max-w-xs"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && nameDraft.trim() && renameMutation.mutate(nameDraft.trim())}
              />
              <Button size="sm" onClick={() => nameDraft.trim() && renameMutation.mutate(nameDraft.trim())} disabled={renameMutation.isPending}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              className="group flex items-center gap-2 min-w-0"
              onClick={() => { setNameDraft(dashboard.name); setEditingName(true); }}
              title="Rename dashboard"
            >
              <h1 className="truncate font-display text-2xl font-bold tracking-tight text-foreground">{dashboard.name}</h1>
              <Pencil className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
          {dashboard.is_builtin && (
            <Badge variant="secondary" className="normal-case tracking-normal shrink-0">Example</Badge>
          )}
        </div>
        <Button size="sm" onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
          {refreshMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {dashboard.widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <LayoutDashboard className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium text-foreground">No widgets yet</p>
          <p className="mt-1 text-sm text-muted-foreground/70">Save a query result as a widget to see it here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {dashboard.widgets.map((w) => {
            const fresh = refreshData[w.id];
            const rows = fresh?.rows ?? [];
            const config = widgetChartConfig(w.chart_type, w.chart_config, rows);
            return (
              <div key={w.id} className="rounded-xl border border-border bg-card/70 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-foreground">{w.title}</p>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={w.chart_type}
                      onChange={(e) => chartTypeMutation.mutate({ widgetId: w.id, chartType: e.target.value })}
                      className="rounded-lg border border-border bg-background/60 px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                      title="Chart type"
                    >
                      {CHART_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {deleteWidgetConfirmId === w.id ? (
                      <>
                        <button
                          onClick={() => deleteWidgetMutation.mutate(w.id)}
                          className="rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteWidgetConfirmId(null)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <ItemActionsMenu
                        actions={[
                          {
                            key: 'remove-widget',
                            label: 'Remove widget',
                            icon: Trash2,
                            destructive: true,
                            onClick: () => setDeleteWidgetConfirmId(w.id),
                          },
                        ]}
                      />
                    )}
                  </div>
                </div>
                {fresh?.error ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    {fresh.error}
                  </div>
                ) : rows.length > 0 ? (
                  <DataChart data={rows} config={config} />
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    Click Refresh to load this widget's data.
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

// ── Dashboards list view ─────────────────────────────────────────────────────

export default function DashboardsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<DashboardListResponse>({
    queryKey: ['dashboards'],
    queryFn: () => getDashboards({ limit: 50, offset: 0 }),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createDashboard({ name }),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      setNewName('');
      setSelectedId(d.id);
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => duplicateDashboard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      toast({ title: 'Dashboard duplicated', variant: 'success' });
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDashboard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      setDeleteConfirmId(null);
      toast({ title: 'Dashboard deleted', variant: 'success' });
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  if (selectedId) {
    return <DashboardDetail dashboardId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const items = data?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Dashboards</h1>
          <p className="mt-1 text-muted-foreground">Compose your saved query results into live charts.</p>
        </div>
        <span className="rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-xs text-muted-foreground">
          {data?.total ?? 0} total
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New dashboard name…"
          className="max-w-xs"
          onKeyDown={(e) => e.key === 'Enter' && newName.trim() && createMutation.mutate(newName.trim())}
        />
        <Button
          size="sm"
          onClick={() => newName.trim() && createMutation.mutate(newName.trim())}
          disabled={!newName.trim() || createMutation.isPending}
        >
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <LayoutDashboard className="h-7 w-7 text-primary" />
          </div>
          <p className="font-medium text-foreground">No dashboards yet</p>
          <p className="mt-1 text-sm text-muted-foreground/70">Create one above to start composing charts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((d) => (
            <div
              key={d.id}
              className="group flex flex-col justify-between rounded-xl border border-border bg-card/70 p-4 transition-all hover:border-primary/30"
            >
              <button className="text-left" onClick={() => setSelectedId(d.id)}>
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <LayoutDashboard className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-foreground">{d.name}</p>
                  {d.is_builtin && (
                    <Badge variant="secondary" className="normal-case tracking-normal shrink-0">Example</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {d.widget_count} widget{d.widget_count === 1 ? '' : 's'} · updated {new Date(d.updated_at).toLocaleDateString()}
                </p>
              </button>
              <div className="mt-3 flex items-center gap-1 border-t border-border/50 pt-3">
                <button
                  onClick={() => duplicateMutation.mutate(d.id)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-primary"
                  title="Duplicate"
                >
                  <Copy className="h-4 w-4" />
                </button>
                {deleteConfirmId === d.id ? (
                  <>
                    <button
                      onClick={() => deleteMutation.mutate(d.id)}
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
                      { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onClick: () => setDeleteConfirmId(d.id) },
                    ]}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
