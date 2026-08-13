import { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import { getRagConfig, updateRagConfig, type RagConfig } from '../../api/client';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { FormMessage } from '../../components/ui/form-message';
import { cn } from '@/lib/utils';
import InfoTip from '../../components/InfoTip';

function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary animate-fade-in">
      <Check className="h-3.5 w-3.5" /> Saved
    </span>
  );
}

function Toggle({
  id,
  label,
  info,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  info?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border accent-primary"
      />
      <Label htmlFor={id}>
        {label}
        {info && <InfoTip text={info} />}
      </Label>
    </div>
  );
}

function NumberField({
  id,
  label,
  info,
  value,
  min,
  max,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  info?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onBlur?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {info && <InfoTip text={info} />}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onBlur={onBlur}
        className="max-w-[8rem]"
      />
    </div>
  );
}

export default function RagSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<RagConfig>({
    queryKey: ['rag-config'],
    queryFn: getRagConfig,
  });

  const mutation = useMutation({
    mutationFn: (updates: Partial<RagConfig>) => updateRagConfig(updates),
    onSuccess: (fresh) => queryClient.setQueryData(['rag-config'], fresh),
  });

  const [form, setForm] = useState<RagConfig | null>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (isLoading || !form) {
    return <p className="text-sm text-muted-foreground">Loading RAG settings…</p>;
  }
  if (error) {
    return <FormMessage>Failed to load RAG settings.</FormMessage>;
  }

  const commit = async (next: RagConfig) => {
    setForm(next);
    setSaveError('');
    if (next.adaptive_top_k_min > next.adaptive_top_k_max) {
      setSaveError('Adaptive top-k min cannot exceed max.');
      return;
    }
    try {
      await mutation.mutateAsync(next);
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1500);
    } catch {
      setSaveError('Failed to save RAG settings.');
    }
  };

  const set = <K extends keyof RagConfig>(key: K, value: RagConfig[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Retrieval quality</h3>
        <p className="text-xs text-muted-foreground">
          These control how the AI retrieves context for your questions. Changes take effect on
          the next query — no re-ingest needed.
        </p>
      </div>

      <div className="space-y-4">
        <Toggle
          id="rag-multi-query"
          label="Multi-query retrieval"
          info="Run retrieval on the question plus a few synonym expansions and merge the results for better recall (P3)."
          checked={form.multi_query_enabled}
          onChange={(v) => commit({ ...form, multi_query_enabled: v })}
        />
        {form.multi_query_enabled && (
          <NumberField
            id="rag-multi-query-max"
            label="Max extra query variants"
            info="How many synonym expansions to search alongside the original question."
            value={form.multi_query_max}
            min={0}
            max={10}
            onChange={(v) => set('multi_query_max', v)}
            onBlur={() => commit(form)}
          />
        )}

        <Toggle
          id="rag-few-shot"
          label="Few-shot example retrieval"
          info="Inject the most semantically-similar past successful NL→SQL pairs into the prompt as examples (P2)."
          checked={form.few_shot_retrieval_enabled}
          onChange={(v) => commit({ ...form, few_shot_retrieval_enabled: v })}
        />
        {form.few_shot_retrieval_enabled && (
          <NumberField
            id="rag-few-shot-topk"
            label="Few-shot examples (top-k)"
            info="Number of similar past examples to inject into the generation prompt."
            value={form.few_shot_top_k}
            min={0}
            max={10}
            onChange={(v) => set('few_shot_top_k', v)}
            onBlur={() => commit(form)}
          />
        )}
      </div>

      <div className="h-px bg-border/50" />

      <div className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">
            These are advanced retrieval and indexing controls with jargon and per-query cost
            implications — most people don't need to change them.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          Advanced settings
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', advancedOpen && 'rotate-180')} />
        </button>

        {advancedOpen && (
          <div className="space-y-5 rounded-lg border border-border/70 bg-background/20 p-4">
            <div className="space-y-4">
              <Toggle
                id="rag-hyde"
                label="HyDE (hypothetical document embeddings)"
                info="Embed an LLM-generated hypothetical schema fragment instead of the raw question. Adds one LLM call per query (P5)."
                checked={form.hyde_enabled}
                onChange={(v) => commit({ ...form, hyde_enabled: v })}
              />

              <Toggle
                id="rag-adaptive-topk"
                label="Adaptive top-k"
                info="Scale how many schema chunks are retrieved by the estimated complexity of the question (P7)."
                checked={form.adaptive_top_k_enabled}
                onChange={(v) => commit({ ...form, adaptive_top_k_enabled: v })}
              />
              {form.adaptive_top_k_enabled && (
                <div className="flex gap-4">
                  <NumberField
                    id="rag-topk-min"
                    label="Min top-k"
                    value={form.adaptive_top_k_min}
                    min={1}
                    max={50}
                    onChange={(v) => set('adaptive_top_k_min', v)}
                    onBlur={() => commit(form)}
                  />
                  <NumberField
                    id="rag-topk-max"
                    label="Max top-k"
                    value={form.adaptive_top_k_max}
                    min={1}
                    max={50}
                    onChange={(v) => set('adaptive_top_k_max', v)}
                    onBlur={() => commit(form)}
                  />
                </div>
              )}
            </div>

            <div className="h-px bg-border/50" />

            <div>
              <h3 className="text-sm font-semibold text-foreground">Ingestion quality</h3>
              <p className="text-xs text-muted-foreground">
                These change how the schema is indexed and can add LLM cost at ingest time —
                re-ingest your schema for them to take effect.
              </p>
            </div>

            <div className="space-y-4">
              <Toggle
                id="rag-descriptions"
                label="LLM table descriptions"
                info="Generate a natural-language description for each table at ingest time and embed it alongside the DDL (P1). Requires a re-ingest."
                checked={form.schema_descriptions_enabled}
                onChange={(v) => commit({ ...form, schema_descriptions_enabled: v })}
              />
              <Toggle
                id="rag-parent-child"
                label="Parent-child chunking"
                info="Index fine-grained column-level chunks for retrieval precision while returning the full table for generation (P4). Requires a re-ingest."
                checked={form.parent_child_chunking_enabled}
                onChange={(v) => commit({ ...form, parent_child_chunking_enabled: v })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <FormMessage>{saveError}</FormMessage>
        <SavedBadge show={saved && !saveError} />
      </div>
    </div>
  );
}
