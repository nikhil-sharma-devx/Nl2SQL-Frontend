import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import {
  getGlossary,
  createGlossaryEntry,
  updateGlossaryEntry,
  deleteGlossaryEntry,
  handleApiError,
  type GlossaryEntry,
} from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';

function AddEntryForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => createGlossaryEntry({ term: term.trim(), definition: definition.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary'] });
      onDone();
    },
    onError: (err) => setError(handleApiError(err)),
  });

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">New Glossary Entry</p>
      <Input
        placeholder="Term (e.g. LTV, ARR, Churn)"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      <Input
        placeholder="Definition"
        value={definition}
        onChange={(e) => setDefinition(e.target.value)}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={!term.trim() || !definition.trim() || mutation.isPending}
        >
          <Check className="h-3.5 w-3.5" />
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
      </div>
    </div>
  );
}

function EntryRow({ entry }: { entry: GlossaryEntry }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editTerm, setEditTerm] = useState(entry.term);
  const [editDef, setEditDef] = useState(entry.definition);

  const updateMutation = useMutation({
    mutationFn: () => updateGlossaryEntry(entry.id, { term: editTerm.trim(), definition: editDef.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary'] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGlossaryEntry(entry.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['glossary'] }),
  });

  if (editing) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
        <Input value={editTerm} onChange={(e) => setEditTerm(e.target.value)} placeholder="Term" />
        <Input value={editDef} onChange={(e) => setEditDef(e.target.value)} placeholder="Definition" />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => updateMutation.mutate()}
            disabled={!editTerm.trim() || !editDef.trim() || updateMutation.isPending}
          >
            <Check className="h-3.5 w-3.5" /> Save
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between gap-3 rounded-xl border border-border bg-card/30 px-3 py-2.5 hover:bg-card/50 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{entry.term}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{entry.definition}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function GlossarySettings() {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['glossary', search],
    queryFn: () => getGlossary(search || undefined),
    staleTime: 10_000,
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <p className="text-sm text-muted-foreground">
          Define business terms that get automatically injected into your query prompts. Capped at 500 characters per query to protect token budget.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder="Search terms…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Term
          </Button>
        )}
      </div>

      {adding && <AddEntryForm onDone={() => setAdding(false)} />}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {search ? `No terms matching "${search}"` : 'No glossary entries yet. Add your first term above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(entry => <EntryRow key={entry.id} entry={entry} />)}
          <p className="text-xs text-muted-foreground text-right">{data?.total ?? items.length} entries</p>
        </div>
      )}
    </div>
  );
}
