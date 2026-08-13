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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { FormMessage } from '@/components/ui/form-message';
import { EmptyState } from '@/components/ui/empty-state';
import { ItemActionsMenu } from '@/components/ItemActionsMenu';
import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';
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
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['metrics'] });

  const reportError = (e: unknown) => {
    const msg = handleApiError(e);
    setError(msg);
    toast({ title: msg, variant: 'error' });
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      updateMetric(metric.metric_id, {
        name,
        description,
        sql_definition: sqlDefinition,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      }),
    onMutate: () => setError(null),
    onSuccess: () => {
      invalidate();
      setEditing(false);
      setError(null);
      toast({ title: 'Metric updated', variant: 'success' });
    },
    onError: reportError,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMetric(metric.metric_id),
    onMutate: () => setError(null),
    onSuccess: () => {
      invalidate();
      setError(null);
      toast({ title: 'Metric deleted', variant: 'success' });
    },
    onError: reportError,
  });

  const certifyMutation = useMutation({
    mutationFn: () => (metric.certified ? uncertifyMetric(metric.metric_id) : certifyMetric(metric.metric_id)),
    onMutate: () => setError(null),
    onSuccess: (m) => {
      invalidate();
      setError(null);
      toast({ title: m.certified ? 'Metric certified' : 'Certification removed', variant: 'success' });
    },
    onError: reportError,
  });

  const previewMutation = useMutation({
    mutationFn: () => previewMetric(metric.metric_id),
    onMutate: () => setError(null),
    onSuccess: (res) => {
      setPreview(res);
      setShowPreview(true);
      setError(null);
    },
    onError: reportError,
  });

  const hasValidationErrors = metric.validation_errors.length > 0;

  return (
    <div className="glass-card card-lift rounded-xl p-4">
      {editing ? (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor={`metric-name-${metric.metric_id}`}>Metric name</Label>
            <Input id={`metric-name-${metric.metric_id}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Metric name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`metric-description-${metric.metric_id}`}>Description</Label>
            <Textarea
              id={`metric-description-${metric.metric_id}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              className="min-h-[60px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`metric-sql-${metric.metric_id}`}>SQL definition</Label>
            <Textarea
              id={`metric-sql-${metric.metric_id}`}
              value={sqlDefinition}
              onChange={(e) => setSqlDefinition(e.target.value)}
              placeholder="SQL definition"
              className="min-h-[80px] font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`metric-tags-${metric.metric_id}`}>Tags</Label>
            <Input id={`metric-tags-${metric.metric_id}`} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated)" />
          </div>
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
                  <Badge variant="violet">
                    <BadgeCheck className="h-3 w-3" />
                    Certified
                  </Badge>
                )}
                {hasValidationErrors && (
                  <Badge variant="destructive" title={metric.validation_errors.join('; ')}>
                    SQL warning
                  </Badge>
                )}
              </div>
              {metric.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{metric.description}</p>
              )}
              {metric.owner && <p className="mt-0.5 text-[11px] text-muted-foreground/60">Owner: {metric.owner}</p>}
              {metric.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {metric.tags.map((t) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
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
      <FormMessage className="mt-2">{error}</FormMessage>
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
  const [createError, setCreateError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const listRef = useRevealOnScroll<HTMLDivElement>();

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
    onMutate: () => setCreateError(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      setName('');
      setDescription('');
      setSqlDefinition('');
      setTags('');
      setShowCreate(false);
      setCreateError(null);
      toast({ title: 'Metric created', variant: 'success' });
    },
    onError: (e) => {
      const msg = handleApiError(e);
      setCreateError(msg);
      toast({ title: msg, variant: 'error' });
    },
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
            aria-label="Search metrics"
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
          <div className="space-y-1.5">
            <Label htmlFor="new-metric-name">Metric name</Label>
            <Input id="new-metric-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Metric name, e.g. Net Revenue" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-metric-description">Description</Label>
            <Textarea
              id="new-metric-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              className="min-h-[60px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-metric-sql">SQL definition</Label>
            <Textarea
              id="new-metric-sql"
              value={sqlDefinition}
              onChange={(e) => setSqlDefinition(e.target.value)}
              placeholder="SQL definition, e.g. SELECT SUM(amount) - SUM(refunds) FROM orders"
              className="min-h-[80px] font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-metric-tags">Tags</Label>
            <Input id="new-metric-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated)" />
          </div>
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={!canCreate || createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </Button>
          <FormMessage>{createError}</FormMessage>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="No metrics defined yet"
          description="Create one above and certify it so the SQL generator prefers it over ad-hoc calculations."
          action={{ label: 'New metric', onClick: () => setShowCreate(true), icon: Plus }}
        />
      ) : (
        <div ref={listRef} className="reveal reveal-stagger space-y-3">
          {items.map((m) => (
            <MetricCard key={m.metric_id} metric={m} />
          ))}
        </div>
      )}
    </div>
  );
}
