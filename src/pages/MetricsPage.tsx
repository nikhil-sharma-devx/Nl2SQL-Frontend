import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMetrics,
  createMetric,
  updateMetric,
  deleteMetric,
  certifyMetric,
  uncertifyMetric,
  previewMetric,
  handleApiError,
  type Metric,
  type MetricListResponse,
  type MetricPreviewResponse,
} from '../api/client';
import { toast } from '../components/ui/toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ItemActionsMenu } from '@/components/ItemActionsMenu';
import {
  BadgeCheck,
  Plus,
  Trash2,
  Loader2,
  Search,
  PlayCircle,
  Pencil,
  X,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';

function MetricCard({ metric }: { metric: Metric }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<MetricPreviewResponse | null>(null);
  const [name, setName] = useState(metric.name);
  const [description, setDescription] = useState(metric.description ?? '');
  const [sqlDefinition, setSqlDefinition] = useState(metric.sql_definition);
  const [tags, setTags] = useState(metric.tags.join(', '));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['metrics'] });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateMetric(metric.metric_id, {
        name,
        description,
        sql_definition: sqlDefinition,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      invalidate();
      setEditing(false);
      toast({ title: 'Metric updated', variant: 'success' });
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMetric(metric.metric_id),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Metric deleted', variant: 'success' });
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const certifyMutation = useMutation({
    mutationFn: () => (metric.certified ? uncertifyMetric(metric.metric_id) : certifyMetric(metric.metric_id)),
    onSuccess: (m) => {
      invalidate();
      toast({ title: m.certified ? 'Metric certified' : 'Certification removed', variant: 'success' });
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const previewMutation = useMutation({
    mutationFn: () => previewMetric(metric.metric_id),
    onSuccess: (res) => {
      setPreview(res);
      setShowPreview(true);
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const hasValidationErrors = metric.validation_errors.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card/70 p-4">
      {editing ? (
        <div className="space-y-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Metric name" />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="min-h-[60px]"
          />
          <Textarea
            value={sqlDefinition}
            onChange={(e) => setSqlDefinition(e.target.value)}
            placeholder="SQL definition"
            className="min-h-[80px] font-mono text-xs"
          />
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated)" />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-foreground">{metric.name}</p>
                {metric.is_builtin && (
                  <Badge variant="secondary" className="normal-case tracking-normal">Example</Badge>
                )}
                {metric.certified && (
                  <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    <BadgeCheck className="h-3 w-3" />
                    Certified
                  </span>
                )}
                {hasValidationErrors && (
                  <span
                    className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"
                    title={metric.validation_errors.join('; ')}
                  >
                    SQL warning
                  </span>
                )}
              </div>
              {metric.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{metric.description}</p>
              )}
              {metric.owner && <p className="mt-0.5 text-[11px] text-muted-foreground/60">Owner: {metric.owner}</p>}
              {metric.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {metric.tags.map((t) => (
                    <span key={t} className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <pre className="mt-2 overflow-x-auto rounded-lg border border-border/50 bg-background/40 p-2 text-[11px] text-muted-foreground">
                {metric.sql_definition}
              </pre>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => previewMutation.mutate()}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-primary"
                title="Preview SQL"
              >
                {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-primary"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
              {deleteConfirm ? (
                <>
                  <button
                    onClick={() => deleteMutation.mutate()}
                    className="rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Confirm delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <ItemActionsMenu
                  actions={[
                    {
                      key: 'certify',
                      label: metric.certified ? 'Remove certification' : 'Mark certified',
                      icon: metric.certified ? ShieldOff : ShieldCheck,
                      disabled: certifyMutation.isPending || (!metric.certified && hasValidationErrors),
                      onClick: () => certifyMutation.mutate(),
                    },
                    { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onClick: () => setDeleteConfirm(true) },
                  ]}
                />
              )}
            </div>
          </div>
          {showPreview && preview && (
            <div className="mt-2 rounded-lg border border-border/50 bg-background/40 p-3 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-foreground">Preview</span>
                <button onClick={() => setShowPreview(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {preview.error ? (
                <p className="text-destructive">{preview.error}</p>
              ) : preview.rows ? (
                <p className="text-muted-foreground">{preview.row_count} row(s) returned</p>
              ) : (
                <p className="text-muted-foreground">
                  {preview.message ?? `Estimated rows: ${preview.estimated_rows ?? '—'}, cost: ${preview.estimated_cost ?? '—'}`}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MetricsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sqlDefinition, setSqlDefinition] = useState('');
  const [tags, setTags] = useState('');

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<MetricListResponse>({
    queryKey: ['metrics', search, certifiedOnly],
    queryFn: () => getMetrics({ search: search || undefined, certified_only: certifiedOnly || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createMetric({
        name,
        description: description || undefined,
        sql_definition: sqlDefinition,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      setName('');
      setDescription('');
      setSqlDefinition('');
      setTags('');
      setShowCreate(false);
      toast({ title: 'Metric created', variant: 'success' });
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const items = data?.items ?? [];
  const canCreate = name.trim() && sqlDefinition.trim();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Metrics Catalog</h1>
          <p className="mt-1 text-muted-foreground">Governed business metrics the SQL generator can use directly.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" />
          New metric
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search metrics…"
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={certifiedOnly} onChange={(e) => setCertifiedOnly(e.target.checked)} />
          Certified only
        </label>
      </div>

      {showCreate && (
        <div className="space-y-2 rounded-xl border border-border bg-card/70 p-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Metric name, e.g. Net Revenue" />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="min-h-[60px]"
          />
          <Textarea
            value={sqlDefinition}
            onChange={(e) => setSqlDefinition(e.target.value)}
            placeholder="SQL definition, e.g. SELECT SUM(amount) - SUM(refunds) FROM orders"
            className="min-h-[80px] font-mono text-xs"
          />
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated)" />
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={!canCreate || createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <BadgeCheck className="h-7 w-7 text-primary" />
          </div>
          <p className="font-medium text-foreground">No metrics defined yet</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Create one above and certify it so the SQL generator prefers it over ad-hoc calculations.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <MetricCard key={m.metric_id} metric={m} />
          ))}
        </div>
      )}
    </div>
  );
}
