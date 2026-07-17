import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRagConfig, updateRagConfig, type RagConfig } from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import InfoTip from '../../components/InfoTip';

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
  label,
  info,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  info?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {info && <InfoTip text={info} />}
      </Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
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

  if (isLoading || !form) {
    return <p className="text-sm text-muted-foreground">Loading RAG settings…</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive">Failed to load RAG settings.</p>;
  }

  const set = <K extends keyof RagConfig>(key: K, value: RagConfig[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const handleSave = async () => {
    if (!form) return;
    setSaveError('');
    if (form.adaptive_top_k_min > form.adaptive_top_k_max) {
      setSaveError('Adaptive top-k min cannot exceed max.');
      return;
    }
    try {
      await mutation.mutateAsync(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError('Failed to save RAG settings.');
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Retrieval quality</h3>
        <p className="text-xs text-muted-foreground">
          These take effect on the next query — no re-ingest needed.
        </p>
      </div>

      <div className="space-y-4">
        <Toggle
          id="rag-multi-query"
          label="Multi-query retrieval"
          info="Run retrieval on the question plus a few synonym expansions and merge the results for better recall (P3)."
          checked={form.multi_query_enabled}
          onChange={(v) => set('multi_query_enabled', v)}
        />
        {form.multi_query_enabled && (
          <NumberField
            label="Max extra query variants"
            info="How many synonym expansions to search alongside the original question."
            value={form.multi_query_max}
            min={0}
            max={10}
            onChange={(v) => set('multi_query_max', v)}
          />
        )}

        <Toggle
          id="rag-few-shot"
          label="Few-shot example retrieval"
          info="Inject the most semantically-similar past successful NL→SQL pairs into the prompt as examples (P2)."
          checked={form.few_shot_retrieval_enabled}
          onChange={(v) => set('few_shot_retrieval_enabled', v)}
        />
        {form.few_shot_retrieval_enabled && (
          <NumberField
            label="Few-shot examples (top-k)"
            info="Number of similar past examples to inject into the generation prompt."
            value={form.few_shot_top_k}
            min={0}
            max={10}
            onChange={(v) => set('few_shot_top_k', v)}
          />
        )}

        <Toggle
          id="rag-hyde"
          label="HyDE (hypothetical document embeddings)"
          info="Embed an LLM-generated hypothetical schema fragment instead of the raw question. Adds one LLM call per query (P5)."
          checked={form.hyde_enabled}
          onChange={(v) => set('hyde_enabled', v)}
        />

        <Toggle
          id="rag-adaptive-topk"
          label="Adaptive top-k"
          info="Scale how many schema chunks are retrieved by the estimated complexity of the question (P7)."
          checked={form.adaptive_top_k_enabled}
          onChange={(v) => set('adaptive_top_k_enabled', v)}
        />
        {form.adaptive_top_k_enabled && (
          <div className="flex gap-4">
            <NumberField
              label="Min top-k"
              value={form.adaptive_top_k_min}
              min={1}
              max={50}
              onChange={(v) => set('adaptive_top_k_min', v)}
            />
            <NumberField
              label="Max top-k"
              value={form.adaptive_top_k_max}
              min={1}
              max={50}
              onChange={(v) => set('adaptive_top_k_max', v)}
            />
          </div>
        )}
      </div>

      <div className="h-px bg-border/50" />

      <div>
        <h3 className="text-sm font-semibold text-foreground">Ingestion quality</h3>
        <p className="text-xs text-muted-foreground">
          These change how the schema is indexed — re-ingest your schema for them to take effect.
        </p>
      </div>

      <div className="space-y-4">
        <Toggle
          id="rag-descriptions"
          label="LLM table descriptions"
          info="Generate a natural-language description for each table at ingest time and embed it alongside the DDL (P1). Requires a re-ingest."
          checked={form.schema_descriptions_enabled}
          onChange={(v) => set('schema_descriptions_enabled', v)}
        />
        <Toggle
          id="rag-parent-child"
          label="Parent-child chunking"
          info="Index fine-grained column-level chunks for retrieval precision while returning the full table for generation (P4). Requires a re-ingest."
          checked={form.parent_child_chunking_enabled}
          onChange={(v) => set('parent_child_chunking_enabled', v)}
        />
      </div>

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      {saved && <p className="text-sm text-primary">RAG settings saved.</p>}

      <Button onClick={handleSave} disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Save Changes'}
      </Button>
    </div>
  );
}
