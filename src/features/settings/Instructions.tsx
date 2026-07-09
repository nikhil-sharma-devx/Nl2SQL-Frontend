import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import InfoTip from '../../components/InfoTip';

const CHAR_CAP = 2000;

interface InstructionsData {
  content: string;
  enabled: boolean;
  char_count: number;
  updated_at: string;
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
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const remaining = CHAR_CAP - content.length;

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">
        Persistent context prepended to every generation prompt. Use this for recurring
        preferences like "always use UTC timestamps" or "prefer CTEs over subqueries".
      </p>

      <div className="flex items-center gap-3">
        <input
          id="instr-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <Label htmlFor="instr-enabled">
          Enable custom instructions
          <InfoTip text="When enabled, the text below is prepended to every AI generation prompt as persistent context. Disable to temporarily pause instructions without deleting them." />
        </Label>
      </div>

      <div className="space-y-1">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, CHAR_CAP))}
          placeholder="E.g. Always use UTC for timestamps. Prefer CTEs. Use snake_case aliases."
          rows={7}
          disabled={!enabled}
          className="resize-y font-mono text-sm"
        />
        <p className={`text-right text-xs ${remaining < 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {content.length} / {CHAR_CAP}
        </p>
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive">Failed to save instructions.</p>
      )}
      {saved && <p className="text-sm text-primary">Instructions saved.</p>}

      <Button
        onClick={() => mutation.mutate({ content, enabled })}
        disabled={mutation.isPending || isLoading}
      >
        {mutation.isPending ? 'Saving…' : 'Save Instructions'}
      </Button>
    </div>
  );
}
