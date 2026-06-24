import { useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { analyticsAPI } from '../api/client';
import { Trash2, AlertTriangle, RefreshCw, TrendingUp, Activity, Zap, Clock, AlertCircle, X, LayoutGrid } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const CHART_OPTIONS = [
  { id: 'popular_queries', label: 'Popular Queries' },
  { id: 'table_usage', label: 'Table Usage' },
  { id: 'success_vs_failed', label: 'Success vs Failed' },
  { id: 'failure_patterns', label: 'Failure Patterns' },
  { id: 'additional_stats', label: 'Additional Stats' },
  { id: 'intent_distribution', label: 'Intent Distribution' },
  { id: 'prompt_versions', label: 'Prompt Versions' },
] as const;

type ChartId = typeof CHART_OPTIONS[number]['id'];

const COLORS = ['#10b981', '#22d3ee', '#a78bfa', '#f59e0b', '#fb7185', '#3b82f6'];

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  borderColor: 'var(--border)',
  borderRadius: '10px',
  color: 'var(--foreground)',
  fontSize: '12px',
};

interface AnalyticsSummary {
  total_queries: number;
  successful_queries: number;
  failed_queries: number;
  success_rate: number;
  cached_queries: number;
  cache_hit_rate: number;
  avg_tokens_used: number;
  avg_response_time_ms: number;
  period_days: number;
}

interface PopularQuery {
  question: string;
  count: number;
}

interface TableUsage {
  table_name: string;
  usage_count: number;
}

interface FailurePattern {
  errors: string[];
  count: number;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [popularQueries, setPopularQueries] = useState<PopularQuery[]>([]);
  const [tableUsage, setTableUsage] = useState<TableUsage[]>([]);
  const [failurePatterns, setFailurePatterns] = useState<FailurePattern[]>([]);
  const [intentDistribution, setIntentDistribution] = useState<any[]>([]);
  const [promptVersions, setPromptVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [visibleCharts, setVisibleCharts] = useState<Set<ChartId>>(
    new Set(CHART_OPTIONS.map((c) => c.id))
  );
  const [showChartPicker, setShowChartPicker] = useState(false);

  const toggleChart = (id: ChartId) => {
    setVisibleCharts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const show = (id: ChartId) => visibleCharts.has(id);

  const chartPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showChartPicker) return;
    const handler = (e: MouseEvent) => {
      if (chartPickerRef.current && !chartPickerRef.current.contains(e.target as Node)) {
        setShowChartPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showChartPicker]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const [summaryData, popularData, tableData, failureData, intentData, promptData] = await Promise.all([
        analyticsAPI.getSummary(days),
        analyticsAPI.getPopularQueries(10, days),
        analyticsAPI.getTableUsage(20, days),
        analyticsAPI.getFailurePatterns(days),
        analyticsAPI.getIntentDistribution(days),
        analyticsAPI.getPromptVersions(days),
      ]);
      setSummary(summaryData);
      setPopularQueries(popularData);
      setTableUsage(tableData);
      setFailurePatterns(failureData);
      setIntentDistribution(intentData);
      setPromptVersions(promptData);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setFetchError(error instanceof Error ? error.message : 'Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [days]);

  const handleResetAnalytics = async () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      return;
    }
    try {
      setResetting(true);
      const result = await analyticsAPI.resetAnalytics();
      console.log('Analytics reset:', result);
      setShowResetConfirm(false);
      await fetchData();
    } catch (error) {
      console.error('Failed to reset analytics:', error);
      setFetchError('Failed to reset analytics. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  const cancelReset = () => {
    setShowResetConfirm(false);
  };

  if (loading && !summary) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
        <div className="animate-pulse font-mono text-sm tracking-widest text-primary">ANALYZING DATA…</div>
      </div>
    );
  }

  const statCards = summary
    ? [
        { label: 'Total Queries', value: summary.total_queries, icon: Activity, accent: 'text-foreground', glow: 'group-hover:text-primary' },
        { label: 'Success Rate', value: `${summary.success_rate}%`, icon: TrendingUp, accent: 'text-primary', glow: '' },
        { label: 'Cache Hit Rate', value: `${summary.cache_hit_rate}%`, icon: Zap, accent: 'text-cyan-400', glow: '' },
        { label: 'Avg Response', value: `${Math.round(summary.avg_response_time_ms)}ms`, icon: Clock, accent: 'text-violet-400', glow: '' },
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-6">
      {fetchError && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{fetchError}</span>
          <button onClick={() => setFetchError(null)} className="ml-auto rounded p-0.5 hover:bg-rose-500/20" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Query Analytics</h1>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">Period</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="cursor-pointer rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm text-foreground focus:border-primary/50 focus:outline-none [&>option]:bg-popover"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <div className="relative" ref={chartPickerRef}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowChartPicker((v) => !v)}
              className={showChartPicker ? 'border-primary/40 bg-primary/10 text-primary' : ''}
            >
              <LayoutGrid className="h-4 w-4" />
              Charts
              <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                {visibleCharts.size}/{CHART_OPTIONS.length}
              </span>
            </Button>
            {showChartPicker && (
              <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-popover p-2 shadow-xl">
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Visible Charts</span>
                  <button
                    onClick={() =>
                      setVisibleCharts(
                        visibleCharts.size === CHART_OPTIONS.length
                          ? new Set()
                          : new Set(CHART_OPTIONS.map((c) => c.id))
                      )
                    }
                    className="font-mono text-[10px] text-primary hover:underline"
                  >
                    {visibleCharts.size === CHART_OPTIONS.length ? 'Hide all' : 'Show all'}
                  </button>
                </div>
                {CHART_OPTIONS.map((chart) => (
                  <button
                    key={chart.id}
                    onClick={() => toggleChart(chart.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      visibleCharts.has(chart.id)
                        ? 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-foreground/5'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-colors ${
                        visibleCharts.has(chart.id)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-transparent'
                      }`}
                    >
                      {visibleCharts.has(chart.id) && '✓'}
                    </span>
                    {chart.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {!showResetConfirm ? (
            <Button variant="destructive" size="sm" onClick={handleResetAnalytics}>
              <Trash2 className="h-4 w-4" /> Reset
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5">
              <span className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-rose-300">
                <AlertTriangle className="h-4 w-4" /> Confirm?
              </span>
              <button onClick={handleResetAnalytics} disabled={resetting} className="rounded border border-rose-500/40 bg-rose-500/20 px-2.5 py-1 text-xs font-medium text-rose-200 transition-colors hover:bg-rose-500/40 disabled:opacity-50">
                {resetting ? 'WAIT…' : 'YES'}
              </button>
              <button onClick={cancelReset} disabled={resetting} className="rounded border border-border bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground/85 transition-colors hover:bg-foreground/10 disabled:opacity-50">
                NO
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => (
            <Card key={s.label} className="card-lift group cursor-pointer p-6 transition-all duration-200 hover:border-primary/30">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</h3>
                  <p className={`mt-2 font-display text-3xl font-bold transition-all ${s.accent} ${s.glow}`}>{s.value}</p>
                </div>
                <s.icon className="h-5 w-5 text-muted-foreground/55" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Charts Row 1 */}
      {(show('popular_queries') || show('table_usage')) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {show('popular_queries') && (
            <Card>
              <CardHeader><CardTitle>Top 10 Popular Queries</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={popularQueries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="question" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} angle={-45} textAnchor="end" height={100} />
                    <YAxis tick={{ fill: 'var(--muted-foreground)' }} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--foreground)', fontWeight: 500 }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {show('table_usage') && (
            <Card>
              <CardHeader><CardTitle>Table Usage Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={tableUsage} dataKey="usage_count" nameKey="table_name" cx="50%" cy="50%" outerRadius={100} label={({ table_name, percent }: any) => `${table_name} (${(percent * 100).toFixed(0)}%)`}>
                      {tableUsage.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--foreground)', fontWeight: 500 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Charts Row 2 */}
      {(show('success_vs_failed') || show('failure_patterns')) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {summary && show('success_vs_failed') && (
            <Card>
              <CardHeader><CardTitle>Query Success vs Failed</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={[{ name: 'Successful', value: summary.successful_queries }, { name: 'Failed', value: summary.failed_queries }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      <Cell fill="#10b981" />
                      <Cell fill="#fb7185" />
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--foreground)', fontWeight: 500 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {show('failure_patterns') && (
            <Card>
              <CardHeader><CardTitle>Top Failure Patterns</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-64 space-y-3 overflow-y-auto custom-scrollbar">
                  {failurePatterns.slice(0, 10).map((pattern, idx) => (
                    <div key={idx} className="border-b border-border pb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground/85">{pattern.count} occurrences</span>
                      </div>
                      <div className="mt-1 text-xs text-rose-400/80">
                        {Array.isArray(pattern.errors) ? pattern.errors.join(', ') : String(pattern.errors)}
                      </div>
                    </div>
                  ))}
                  {failurePatterns.length === 0 && <p className="py-4 text-center text-muted-foreground/80">No failures recorded</p>}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Additional Stats */}
      {summary && show('additional_stats') && (
        <Card>
          <CardHeader><CardTitle>Additional Statistics</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="card-lift rounded-xl border border-border bg-background/60 p-4 cursor-pointer">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Avg Tokens Used</p>
                <p className="mt-1 font-display text-2xl font-bold text-foreground">{Math.round(summary.avg_tokens_used)}</p>
              </div>
              <div className="card-lift rounded-xl border border-border bg-background/60 p-4 cursor-pointer">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Cached Queries</p>
                <p className="mt-1 font-display text-2xl font-bold text-cyan-400">{summary.cached_queries}</p>
              </div>
              <div className="card-lift rounded-xl border border-border bg-background/60 p-4 cursor-pointer">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Failed Queries</p>
                <p className="mt-1 font-display text-2xl font-bold text-rose-400">{summary.failed_queries}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row 3 */}
      {(show('intent_distribution') || show('prompt_versions')) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {show('intent_distribution') && (
            <Card>
              <CardHeader><CardTitle>Query Intent Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={intentDistribution} dataKey="count" nameKey="intent_type" cx="50%" cy="50%" outerRadius={100} label={({ intent_type, percent }: any) => `${intent_type} (${(percent * 100).toFixed(0)}%)`}>
                      {intentDistribution.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--foreground)', fontWeight: 500 }} />
                  </PieChart>
                </ResponsiveContainer>
                {intentDistribution.length === 0 && <p className="py-4 text-center text-muted-foreground/80">No intent data available</p>}
              </CardContent>
            </Card>
          )}

          {show('prompt_versions') && (
            <Card>
              <CardHeader><CardTitle>Prompt Version Performance</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={promptVersions}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="prompt_version" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--muted-foreground)' }} label={{ value: 'Success Rate (%)', angle: -90, position: 'insideLeft', fill: 'var(--muted-foreground)' }} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--foreground)', fontWeight: 500 }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Legend wrapperStyle={{ color: 'var(--muted-foreground)' }} />
                    <Bar dataKey="success_rate" fill="#a78bfa" name="Success Rate %" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {promptVersions.length === 0 && <p className="py-4 text-center text-muted-foreground/80">No prompt version data available</p>}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
