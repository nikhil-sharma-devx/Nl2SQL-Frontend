import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient, { executeSQL, type ExecuteResponse } from '../api/client';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import ResultTable from '../components/ResultTable';
import { Star, Trash2, Play, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import type { QueryResponse } from '../types/query.types';

interface SavedQuery {
  id: number;
  title: string | null;
  nl_prompt: string;
  generated_sql: string;
  dialect: string | null;
  starred: boolean;
  last_run_at: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
}

interface SavedQueryListResponse {
  items: SavedQuery[];
  total: number;
}

const LIMIT = 20;

function toQueryResponse(exec: ExecuteResponse, sql: string, dialect: string): QueryResponse {
  return {
    question: '',
    sql,
    dialect,
    is_valid: exec.success,
    validation_errors: [],
    retrieved_tables: [],
    used_tables: [],
    execution_result: exec.results,
    execution_error: exec.error ?? undefined,
    tokens_used: 0,
    cached: false,
  };
}

export default function SavedQueriesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [offset, setOffset] = useState(0);

  const [runningIds, setRunningIds] = useState<Set<number>>(new Set());
  const [runResults, setRunResults] = useState<Record<number, QueryResponse>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<SavedQueryListResponse>({
    queryKey: ['saved-queries', search, starredOnly, offset],
    queryFn: () =>
      apiClient
        .get('/saved-queries', {
          params: {
            search: search || undefined,
            starred: starredOnly || undefined,
            limit: LIMIT,
            offset,
          },
        })
        .then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const handleStar = (q: SavedQuery) => {
    apiClient
      .patch(`/saved-queries/${q.id}`, { starred: !q.starred })
      .then(() => queryClient.invalidateQueries({ queryKey: ['saved-queries'] }));
  };

  // Optimistic delete (TanStack Query v5): patch every cached ['saved-queries', …]
  // list immediately, roll back on error, and reconcile on settle.
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/saved-queries/${id}`),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ['saved-queries'] });
      const previous = queryClient.getQueriesData<SavedQueryListResponse>({ queryKey: ['saved-queries'] });
      queryClient.setQueriesData<SavedQueryListResponse>({ queryKey: ['saved-queries'] }, (old) =>
        old
          ? { ...old, items: old.items.filter((q) => q.id !== id), total: Math.max(0, old.total - 1) }
          : old,
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-queries'] });
    },
  });

  const handleDelete = (id: number) => deleteMutation.mutate(id);

  const handleRun = async (q: SavedQuery) => {
    setRunningIds(prev => new Set(prev).add(q.id));
    setExpandedId(q.id);

    try {
      // Increment run count
      await apiClient.post(`/saved-queries/${q.id}/run`);
      queryClient.invalidateQueries({ queryKey: ['saved-queries'] });

      // Execute SQL and capture results
      const exec = await executeSQL({ sql: q.generated_sql, dialect: q.dialect ?? undefined });
      setRunResults(prev => ({ ...prev, [q.id]: toQueryResponse(exec, q.generated_sql, q.dialect ?? '') }));
    } catch {
      setRunResults(prev => ({
        ...prev,
        [q.id]: toQueryResponse(
          { sql: q.generated_sql, success: false, results: null, error: 'Execution failed. Check your schema connection.', row_count: 0 },
          q.generated_sql,
          q.dialect ?? '',
        ),
      }));
    } finally {
      setRunningIds(prev => {
        const s = new Set(prev);
        s.delete(q.id);
        return s;
      });
    }
  };

  const total = data?.total ?? 0;
  const pages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 pb-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Saved Queries</h1>
          <p className="mt-1 text-muted-foreground">Your bookmarked SQL queries for quick access.</p>
        </div>
        <span className="rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-xs text-muted-foreground">
          {total} saved
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          placeholder="Search queries…"
          className="max-w-xs"
        />
        <button
          onClick={() => { setStarredOnly(v => !v); setOffset(0); }}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors',
            starredOnly
              ? 'border-amber-400/50 bg-amber-400/10 text-amber-400'
              : 'border-border text-muted-foreground hover:border-primary/40',
          )}
        >
          <Star className={cn('h-3.5 w-3.5', starredOnly && 'fill-amber-400')} />
          Starred only
        </button>
        <span className="text-sm text-muted-foreground">{total} total</span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
            <Star className="h-7 w-7 text-amber-400" />
          </div>
          <p className="font-medium text-foreground">No saved queries yet</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Star a query from the chat to save it here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.items.map(q => {
            const isRunning = runningIds.has(q.id);
            const result = runResults[q.id];
            const isExpanded = expandedId === q.id;

            return (
              <div
                key={q.id}
                className="rounded-xl border border-border bg-card/70 transition-all duration-200 hover:border-primary/30"
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {q.title ?? q.nl_prompt.slice(0, 60)}
                      </p>
                      {q.title && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{q.nl_prompt}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleStar(q)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-amber-400 transition-colors"
                        title={q.starred ? 'Unstar' : 'Star'}
                      >
                        <Star className={cn('h-4 w-4', q.starred && 'fill-amber-400 text-amber-400')} />
                      </button>
                      <button
                        onClick={() => handleRun(q)}
                        disabled={isRunning}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                        title="Run query"
                      >
                        {isRunning
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Play className="h-4 w-4" />
                        }
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <pre className="text-xs font-mono text-muted-foreground bg-background/40 rounded-lg p-2 overflow-x-auto max-h-24 overflow-y-auto custom-scrollbar">
                    {q.generated_sql}
                  </pre>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {q.dialect && <Badge variant="outline" className="text-xs">{q.dialect}</Badge>}
                    <span>Run {q.run_count}×</span>
                    {q.last_run_at && <span>Last run {new Date(q.last_run_at).toLocaleDateString()}</span>}
                    <span>Saved {new Date(q.created_at).toLocaleDateString()}</span>
                    {result && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : q.id)}
                        className="ml-auto flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {isExpanded ? 'Hide results' : 'Show results'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Results panel */}
                {result && isExpanded && (
                  <div className="border-t border-border/60 px-4 pb-4 pt-3">
                    <ResultTable response={result} />
                  </div>
                )}

                {/* Loading shimmer */}
                {isRunning && (
                  <div className="border-t border-border/60 px-4 pb-4 pt-3">
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-6 w-5/6" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            disabled={offset === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(offset + LIMIT)}
            disabled={currentPage >= pages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
