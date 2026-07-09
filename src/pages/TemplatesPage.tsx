import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  FileCode2,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Play,
  Tag,
  X,
} from 'lucide-react';
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  renderTemplate,
  handleApiError,
  type QueryTemplate,
} from '../api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ── Template Form ─────────────────────────────────────────────────────────────

interface TemplateFormValues {
  name: string;
  description: string;
  template_nl: string;
  template_sql: string;
  tags: string;
}

function TemplateForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial?: Partial<TemplateFormValues>;
  onSave: (v: TemplateFormValues) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<TemplateFormValues>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    template_nl: initial?.template_nl ?? '',
    template_sql: initial?.template_sql ?? '',
    tags: initial?.tags ?? '',
  });

  const isValid = form.name.trim() && form.template_nl.trim() && form.template_sql.trim();

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input
          placeholder="e.g. Revenue by Month"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Input
          placeholder="Optional — what does this template do?"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Natural Language Template *</Label>
        <Textarea
          rows={2}
          placeholder="Show me {{metric}} for {{time_period}}"
          value={form.template_nl}
          onChange={e => setForm(f => ({ ...f, template_nl: e.target.value }))}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">Use {'{{param_name}}'} for variable placeholders.</p>
      </div>
      <div className="space-y-1.5">
        <Label>SQL Template *</Label>
        <Textarea
          rows={5}
          placeholder="SELECT {{metric}} FROM orders WHERE date_trunc('month', created_at) = {{time_period}}"
          value={form.template_sql}
          onChange={e => setForm(f => ({ ...f, template_sql: e.target.value }))}
          className="font-mono text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Tags</Label>
        <Input
          placeholder="revenue, monthly, finance (comma-separated)"
          value={form.tags}
          onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={() => onSave(form)} disabled={!isValid || isSaving}>
          {isSaving ? 'Saving…' : 'Save Template'}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Render Panel ──────────────────────────────────────────────────────────────

function extractPlaceholders(text: string): string[] {
  const matches = text.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map(m => m[1]))];
}

function RenderPanel({ template }: { template: QueryTemplate }) {
  const allParams = extractPlaceholders(template.template_nl + ' ' + template.template_sql);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ nl: string; sql: string; missing_params: string[] } | null>(null);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => renderTemplate(template.id, values),
    onSuccess: (data) => { setResult(data); setError(''); },
    onError: (err) => setError(handleApiError(err)),
  });

  if (allParams.length === 0) {
    return <p className="text-sm text-muted-foreground">This template has no placeholders — use it as-is.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {allParams.map(param => (
          <div key={param} className="space-y-1">
            <Label className="font-mono text-xs">{`{{${param}}}`}</Label>
            <Input
              placeholder={`Value for ${param}`}
              value={values[param] ?? ''}
              onChange={e => setValues(v => ({ ...v, [param]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        <Play className="h-3.5 w-3.5" />
        {mutation.isPending ? 'Rendering…' : 'Render'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className="space-y-3">
          {result.missing_params.length > 0 && (
            <p className="text-xs text-amber-400">Still missing: {result.missing_params.join(', ')}</p>
          )}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rendered NL</p>
            <div className="rounded-lg border border-border bg-background/60 p-3 text-sm text-foreground">
              {result.nl}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rendered SQL</p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-xs text-foreground">
              {result.sql}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({ template }: { template: QueryTemplate }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'sql' | 'render'>('sql');
  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const paramCount = extractPlaceholders(template.template_nl + ' ' + template.template_sql).length;

  const updateMutation = useMutation({
    mutationFn: (v: ReturnType<typeof formValuesToPayload>) => updateTemplate(template.id, v),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['templates'] }); setEditing(false); },
  });

  // Optimistic delete (TanStack Query v5): remove this template from every
  // cached ['templates', …] list at once, roll back on error, invalidate after.
  const deleteMutation = useMutation({
    mutationFn: () => deleteTemplate(template.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['templates'] });
      const previous = queryClient.getQueriesData<{ items: QueryTemplate[]; total: number }>({ queryKey: ['templates'] });
      queryClient.setQueriesData<{ items: QueryTemplate[]; total: number }>({ queryKey: ['templates'] }, (old) =>
        old
          ? { ...old, items: old.items.filter((t) => t.id !== template.id), total: Math.max(0, old.total - 1) }
          : old,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });

  function formValuesToPayload(v: { name: string; description: string; template_nl: string; template_sql: string; tags: string }) {
    return {
      name: v.name,
      description: v.description || undefined,
      template_nl: v.template_nl,
      template_sql: v.template_sql,
      tags: v.tags ? v.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      {/* Header */}
      <div
        className="flex cursor-pointer items-start gap-3 p-4 hover:bg-foreground/[0.02] transition-colors"
        onClick={() => { if (!editing) setExpanded(v => !v); }}
      >
        <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-foreground">{template.name}</p>
            {paramCount > 0 && (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                {paramCount} param{paramCount !== 1 ? 's' : ''}
              </span>
            )}
            {template.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                <Tag className="h-2.5 w-2.5" />{tag}
              </span>
            ))}
          </div>
          {template.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setEditing(v => !v); setExpanded(true); }}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {deleteConfirm ? (
            <>
              <button
                onClick={e => { e.stopPropagation(); deleteMutation.mutate(); }}
                className="rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
              >
                Confirm delete
              </button>
              <button
                onClick={e => { e.stopPropagation(); setDeleteConfirm(false); }}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); setDeleteConfirm(true); }}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground/50" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
          }
        </div>
      </div>

      {/* Expanded content */}
      {expanded && !editing && (
        <div className="border-t border-border">
          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-3">
            {(['sql', 'render'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                  activeTab === t
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t === 'sql' ? 'SQL / NL' : 'Render'}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3">
            {activeTab === 'sql' && (
              <>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Natural Language</p>
                  <div className="rounded-lg border border-border bg-background/60 p-3 text-sm text-foreground">
                    {template.template_nl}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SQL</p>
                  <pre className="overflow-x-auto custom-scrollbar rounded-lg border border-border bg-background/60 p-3 font-mono text-xs text-foreground whitespace-pre-wrap">
                    {template.template_sql}
                  </pre>
                </div>
              </>
            )}
            {activeTab === 'render' && <RenderPanel template={template} />}
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="border-t border-border p-4">
          <TemplateForm
            initial={{
              name: template.name,
              description: template.description ?? '',
              template_nl: template.template_nl,
              template_sql: template.template_sql,
              tags: template.tags.join(', '),
            }}
            onSave={(v) => updateMutation.mutate(formValuesToPayload(v))}
            onCancel={() => setEditing(false)}
            isSaving={updateMutation.isPending}
          />
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [limit, setLimit] = useState(50);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['templates', search, limit],
    queryFn: () => getTemplates({ search: search || undefined, limit }),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: (v: { name: string; description: string; template_nl: string; template_sql: string; tags: string }) =>
      createTemplate({
        name: v.name,
        description: v.description || undefined,
        template_nl: v.template_nl,
        template_sql: v.template_sql,
        tags: v.tags ? v.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setCreating(false);
    },
  });

  const items = data?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Query Templates</h1>
        <p className="mt-1 text-muted-foreground">
          Parameterized SQL patterns with <code className="rounded border border-border bg-background/70 px-1.5 py-0.5 font-mono text-xs">{`{{placeholder}}`}</code> variables you can fill in before running.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder="Search templates…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New Template
          </Button>
        )}
      </div>

      {creating && (
        <TemplateForm
          onSave={(v) => createMutation.mutate(v)}
          onCancel={() => setCreating(false)}
          isSaving={createMutation.isPending}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl border border-border bg-card/40 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <FileCode2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            {search ? `No templates matching "${search}"` : 'No templates yet.'}
          </p>
          {!search && (
            <p className="mt-1 text-xs text-muted-foreground/70">
              Create your first template to save parameterized SQL patterns.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(t => <TemplateCard key={t.id} template={t} />)}
          {(data?.total ?? 0) > items.length && limit < 100 && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setLimit(100)} disabled={isFetching}>
                Load more ({items.length} of {data?.total})
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground text-right">{data?.total ?? items.length} template{(data?.total ?? items.length) !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  );
}
