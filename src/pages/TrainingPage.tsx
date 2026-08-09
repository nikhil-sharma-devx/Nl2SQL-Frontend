import { useState, useEffect, useCallback } from 'react';
import {
  BrainCircuit,
  Database,
  CheckCircle2,
  Clock,
  Zap,
  Play,
  RefreshCw,
  Rocket,
  FileJson,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Download,
  CreditCard,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trainingAPI, type TrainingStats, type FineTuningJob } from '../api/client';

const FINE_TUNABLE_MODELS = [
  { value: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Reference', label: 'Llama 3.1 8B', note: 'Fast, cost-effective' },
  { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Reference', label: 'Llama 3.1 70B', note: 'Best quality' },
  { value: 'meta-llama/Llama-3.2-3B-Instruct', label: 'Llama 3.2 3B', note: 'Smallest, cheapest' },
  { value: 'mistralai/Mistral-7B-Instruct-v0.3', label: 'Mistral 7B', note: 'Efficient alternative' },
];

function statusVariant(status: string): 'default' | 'destructive' | 'info' | 'violet' {
  if (status === 'succeeded') return 'default';
  if (status === 'failed' || status === 'cancelled') return 'destructive';
  if (status === 'running') return 'info';
  return 'violet';
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    validating_files: 'Validating',
    queued: 'Queued',
    running: 'Training',
    succeeded: 'Succeeded',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };
  return map[status] ?? status;
}

function fmtDate(epoch: number | null | undefined) {
  if (!epoch) return '—';
  return new Date(epoch * 1000).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function TrainingPage() {
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [jobs, setJobs] = useState<FineTuningJob[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Download state
  const [downloading, setDownloading] = useState(false);

  // Prepare + start flow
  const [selectedModel, setSelectedModel] = useState('meta-llama/Meta-Llama-3.1-8B-Instruct-Reference');
  const [limit, setLimit] = useState(1000);
  const [preparedPath, setPreparedPath] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      setStats(await trainingAPI.getStats());
    } catch {
      // silently fail — stats stay null
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      setLoadingJobs(true);
      setJobs(await trainingAPI.listJobs(20));
    } catch {
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchJobs();
  }, [fetchStats, fetchJobs]);

  // Auto-refresh while any job is actively running
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'running' || j.status === 'queued' || j.status === 'validating_files');
    if (!hasActive) return;
    const id = setInterval(fetchJobs, 15000);
    return () => clearInterval(id);
  }, [jobs, fetchJobs]);

  const handleDownload = async (format: 'json' | 'jsonl') => {
    setError(null);
    setDownloading(true);
    try {
      await trainingAPI.downloadData(format, limit);
    } catch (e: any) {
      setError(e?.message || 'Failed to download training data.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrepare = async () => {
    setError(null);
    setSuccess(null);
    setPreparedPath(null);
    setPreparing(true);
    try {
      const res = await trainingAPI.prepareFile('jsonl', limit);
      setPreparedPath(res.file_path);
      setSuccess('Training file prepared on server. Review it, then click Start Fine-Tuning.');
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to prepare training file.');
    } finally {
      setPreparing(false);
    }
  };

  const handleStart = async () => {
    if (!preparedPath) return;
    setError(null);
    setSuccess(null);
    setStarting(true);
    try {
      const res = await trainingAPI.startJob(selectedModel, preparedPath);
      setSuccess(`Fine-tuning job started! Job ID: ${res.job_id}`);
      setPreparedPath(null);
      await fetchJobs();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to start fine-tuning job.');
    } finally {
      setStarting(false);
    }
  };

  const handleDeploy = async (modelId: string) => {
    setError(null);
    setSuccess(null);
    setDeployingId(modelId);
    try {
      await trainingAPI.deployModel(modelId);
      setSuccess(`Model ${modelId} is now active — all new queries will use it.`);
      await fetchStats();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to deploy model.');
    } finally {
      setDeployingId(null);
    }
  };

  const statCards = [
    {
      label: 'Total Collected',
      value: stats?.total_records ?? '—',
      icon: Database,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Ready to Train',
      value: stats?.unused_records ?? '—',
      icon: BrainCircuit,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
    },
    {
      label: 'Already Used',
      value: stats?.used_records ?? '—',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Avg Quality Score',
      value: stats ? `${(stats.avg_success_score * 100).toFixed(0)}%` : '—',
      icon: Zap,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
  ];

  const intentEntries = stats
    ? Object.entries(stats.intent_distribution).sort((a, b) => b[1] - a[1])
    : [];

  const canStart = (stats?.unused_records ?? 0) >= 10;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Model Training</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Export your query history as training data, or fine-tune a model using a paid API.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => { fetchStats(); fetchJobs(); }}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="card-lift">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold text-foreground">{loadingStats ? '…' : value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Intent distribution */}
      {intentEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Intent Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {intentEntries.map(([intent, count]) => (
                <div key={intent} className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-1.5">
                  <span className="text-sm font-medium text-foreground">{intent}</span>
                  <Badge variant="violet">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requirement callout */}
      {!loadingStats && !canStart && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-200/90">
            You need at least <strong>10 training records</strong> to export or fine-tune. Currently you have{' '}
            <strong>{stats?.unused_records ?? 0}</strong>. Keep using the app — every successful query is collected automatically.
          </p>
        </div>
      )}

      {/* Feedback messages */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p className="text-sm text-emerald-200/90">{success}</p>
        </div>
      )}

      {/* Download Training Data — FREE */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Download className="h-4 w-4 text-primary" />
              Download Training Data
            </CardTitle>
            <Badge variant="default" className="text-[10px] font-bold uppercase tracking-wider">Free</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Download your collected query–SQL pairs as a JSONL file. Use it anywhere — Google Colab, Hugging Face, or any fine-tuning service.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => handleDownload('jsonl')}
              disabled={downloading || !canStart}
              variant="secondary"
            >
              {downloading ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Downloading…</>
              ) : (
                <><FileJson className="h-4 w-4" /> Download JSONL</>
              )}
            </Button>
            <Button
              onClick={() => handleDownload('json')}
              disabled={downloading || !canStart}
              variant="outline"
              className="text-muted-foreground"
            >
              <Download className="h-4 w-4" /> Download JSON
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            JSONL format is compatible with OpenAI, Together AI, and Hugging Face fine-tuning pipelines.
            For a free GPU, try{' '}
            <span className="font-medium text-foreground/70">Google Colab</span> or{' '}
            <span className="font-medium text-foreground/70">Hugging Face AutoTrain</span>.
          </p>
        </CardContent>
      </Card>

      {/* Cloud Fine-Tuning — PAID */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <BrainCircuit className="h-4 w-4 text-violet-400" />
              Cloud Fine-Tuning
            </CardTitle>
            <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider">Paid API required</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submits your data to Together AI and starts a managed fine-tuning job. Requires a paid Together AI API key set as{' '}
            <code className="rounded bg-background/60 px-1">TOGETHER_API_KEY</code> in your <code className="rounded bg-background/60 px-1">.env</code>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          {/* Paid notice */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs text-amber-200/90 space-y-1">
              <p>
                Together AI fine-tuning is a <strong>paid service</strong>. Costs depend on model size and token count.
                See pricing at <span className="font-medium text-amber-200">api.together.xyz/pricing</span>.
              </p>
              <p>
                Add your Together AI key in{' '}
                <strong className="text-amber-100">Profile → API Keys</strong>{' '}
                (click your avatar in the bottom-left). Your key is stored encrypted and used automatically.
              </p>
            </div>
          </div>

          {/* Model selector */}
          <div>
            <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Base Model
            </label>
            <div className="flex flex-wrap gap-2">
              {FINE_TUNABLE_MODELS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setSelectedModel(m.value)}
                  className={`flex flex-col rounded-lg border px-3 py-2 text-left transition-all ${
                    selectedModel === m.value
                      ? 'border-violet-500/60 bg-violet-500/10 text-foreground'
                      : 'border-border bg-background/40 text-muted-foreground hover:border-border/80 hover:text-foreground'
                  }`}
                >
                  <span className="text-sm font-semibold">{m.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{m.note}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Advanced options */}
          <div>
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Advanced options
            </button>
            {showAdvanced && (
              <div className="mt-3">
                <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Max Records
                </label>
                <input
                  type="number"
                  min={10}
                  max={10000}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-32 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <p className="mt-1 text-xs text-muted-foreground">Max 10,000 records per job.</p>
              </div>
            )}
          </div>

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handlePrepare}
              disabled={preparing || !canStart}
              variant="secondary"
            >
              {preparing ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Preparing…</>
              ) : (
                <><FileJson className="h-4 w-4" /> Prepare File</>
              )}
            </Button>

            <Button
              onClick={handleStart}
              disabled={!preparedPath || starting}
              className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
            >
              {starting ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Submitting…</>
              ) : (
                <><Play className="h-4 w-4" /> Start Fine-Tuning</>
              )}
            </Button>

            {preparedPath && (
              <span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-[11px] text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                File ready
              </span>
            )}
          </div>

          {preparedPath && (
            <p className="font-mono text-[11px] text-muted-foreground break-all">
              Server path: <span className="text-foreground/70">{preparedPath}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Clock className="h-4 w-4 text-primary" />
            Fine-Tuning Jobs
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchJobs} disabled={loadingJobs}>
            <RefreshCw className={`h-3.5 w-3.5 ${loadingJobs ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loadingJobs ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading jobs…</div>
          ) : jobs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No fine-tuning jobs yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Job ID</th>
                    <th className="pb-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                    <th className="pb-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Model</th>
                    <th className="pb-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tokens</th>
                    <th className="pb-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Created</th>
                    <th className="pb-2 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Finished</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobs.map((job) => (
                    <tr key={job.job_id} className="transition-colors hover:bg-foreground/[0.03]">
                      <td className="py-3 font-mono text-xs text-muted-foreground truncate max-w-[140px]" title={job.job_id}>
                        {job.job_id.slice(0, 18)}…
                      </td>
                      <td className="py-3">
                        <Badge variant={statusVariant(job.status)}>
                          {statusLabel(job.status)}
                        </Badge>
                      </td>
                      <td className="py-3 font-mono text-xs text-foreground/80">
                        {job.model ? (
                          <span className="max-w-[180px] truncate block" title={job.model}>{job.model}</span>
                        ) : '—'}
                      </td>
                      <td className="py-3 font-mono text-xs text-muted-foreground">
                        {job.trained_tokens?.toLocaleString() ?? '—'}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">{fmtDate(job.created_at)}</td>
                      <td className="py-3 text-xs text-muted-foreground">{fmtDate(job.finished_at)}</td>
                      <td className="py-3 text-right">
                        {job.status === 'succeeded' && job.model && (
                          <Button
                            size="sm"
                            onClick={() => handleDeploy(job.model!)}
                            disabled={deployingId === job.model}
                            className="h-7 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-40"
                          >
                            {deployingId === job.model ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <><Rocket className="h-3.5 w-3.5" /> Deploy</>
                            )}
                          </Button>
                        )}
                        {job.status === 'failed' && job.error && (
                          <span className="font-mono text-[10px] text-destructive" title={job.error}>
                            Error
                          </span>
                        )}
                        {(job.status === 'running' || job.status === 'queued' || job.status === 'validating_files') && (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ol className="space-y-2 text-sm text-foreground/80">
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/25 font-mono text-[11px] font-bold text-primary shadow-[0_0_8px_rgba(16,185,129,0.3)]">1</span>
              <span><strong className="text-foreground">Data collection</strong> — every successful query you run is automatically saved to the training dataset.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/25 font-mono text-[11px] font-bold text-primary shadow-[0_0_8px_rgba(16,185,129,0.3)]">2</span>
              <span><strong className="text-foreground">Download (free)</strong> — export your data as a JSONL file and use it anywhere: Google Colab, Hugging Face AutoTrain, or local fine-tuning with Unsloth.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/25 font-mono text-[11px] font-bold text-primary shadow-[0_0_8px_rgba(16,185,129,0.3)]">3</span>
              <span><strong className="text-foreground">Cloud fine-tune (paid)</strong> — if you have a Together AI or OpenAI API key, you can submit the job directly from here. Together AI charges per token trained.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/25 font-mono text-[11px] font-bold text-primary shadow-[0_0_8px_rgba(16,185,129,0.3)]">4</span>
              <span><strong className="text-foreground">Deploy</strong> — once a cloud job succeeds, hot-swap the running model to your fine-tuned version with no server restart.</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
