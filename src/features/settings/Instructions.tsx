import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import apiClient from '../../api/client';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { FormMessage } from '../../components/ui/form-message';
import InfoTip from '../../components/InfoTip';

const CHAR_CAP = 2000;

interface InstructionsData {
  content: string;
  enabled: boolean;
  char_count: number;
  updated_at: string;
}

function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary animate-fade-in">
      <Check className="h-3.5 w-3.5" /> Saved
    </span>
  );
}

export default function InstructionsSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<InstructionsData>({
    queryKey: ['instructions'],
    queryFn: () => apiClient.get('/instructions').then(r => r.data),
  });

  const [content, setContent] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (data) {
      setContent(data.content);
      setEnabled(data.enabled);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: { content: string; enabled: boolean }) =>
      apiClient.put('/instructions', payload).then(r => r.data),
    onSuccess: (d) => {
      queryClient.setQueryData(['instructions'], d);
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1500);
    },
  });

  const commit = (next: { content: string; enabled: boolean }) => {
    mutation.mutate(next);
  };

  const remaining = CHAR_CAP - content.length;

  return (
    <div className="space-y-4 max-w-lg">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Persistent context prepended to every generation prompt. Use this for recurring
          preferences like "always use UTC timestamps" or "prefer CTEs over subqueries".
        </p>
        <p className="text-xs text-muted-foreground/70">
          Instructions are style/behavior rules for how the AI writes SQL. For business
          vocabulary (what a term means), use the Glossary tab instead.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="instr-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            commit({ content, enabled: e.target.checked });
          }}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <Label htmlFor="instr-enabled">
          Enable custom instructions
          <InfoTip text="When enabled, the text below is prepended to every AI generation prompt as persistent context. Disable to temporarily pause instructions without deleting them." />
        </Label>
      </div>

      <div className="space-y-1">
        <Label htmlFor="instr-content">Instructions text</Label>
        <Textarea
          id="instr-content"
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, CHAR_CAP))}
          onBlur={() => commit({ content, enabled })}
          placeholder="E.g. Always use UTC for timestamps. Prefer CTEs. Use snake_case aliases."
          rows={7}
          disabled={!enabled}
          className="resize-y font-mono text-sm"
        />
        <p className={`text-right text-xs ${remaining < 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {content.length} / {CHAR_CAP}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <FormMessage>{mutation.isError ? 'Failed to save instructions.' : ''}</FormMessage>
        <SavedBadge show={saved && !mutation.isError} />
        {isLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>
    </div>
  );
}
