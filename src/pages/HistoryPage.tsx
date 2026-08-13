import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../context/ThemeContext';
import {
  Clock,
  MessageSquare,
  Trash2,
  AlertCircle,
  Loader2,
  Check,
  X,
  Database,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import {
  getSessions,
  getSession,
  deleteSession,
  deleteAllSessions,
  handleApiError,
  type SessionDetail,
  type SessionListResponse,
} from '../api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useRevealOnScroll } from '@/hooks/useRevealOnScroll';

const HistoryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const isLightTheme = theme === 'parchment' || theme === 'sienna';
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const sessionsListRef = useRevealOnScroll<HTMLDivElement>();

  useEffect(() => {
    const state = location.state as { selectedSessionId?: string };
    if (state?.selectedSessionId) {
      const loadSession = async (sessionId: string) => {
        try {
          const sessionDetail = await getSession(sessionId);
          setSelectedSession(sessionDetail);
        } catch (error) {
          console.error('Failed to load session:', error);
        }
      };
      loadSession(state.selectedSessionId);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const { data: sessionsData, isLoading, isFetching } = useQuery({
    queryKey: ['sessions', limit],
    queryFn: () => getSessions(limit, 0),
    placeholderData: (prev) => prev,
  });

  // TanStack Query v5 optimistic-update helpers. All session lists are cached
  // under keys prefixed with ['sessions', …] (see the useQuery above), so we
  // snapshot/patch/rollback across every matching cache entry.
  const snapshotSessions = async () => {
    await queryClient.cancelQueries({ queryKey: ['sessions'] });
    return queryClient.getQueriesData<SessionListResponse>({ queryKey: ['sessions'] });
  };
  const rollbackSessions = (context?: { previous: [readonly unknown[], SessionListResponse | undefined][] }) => {
    context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
  };

  const clearMutation = useMutation({
    mutationFn: deleteAllSessions,
    onMutate: async () => {
      const previous = await snapshotSessions();
      queryClient.setQueriesData<SessionListResponse>({ queryKey: ['sessions'] }, (old) =>
        old ? { ...old, sessions: [], total: 0 } : old,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => rollbackSessions(context),
    onSuccess: () => {
      setShowClearConfirm(false);
      setSelectedSession(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSession,
    onMutate: async (sessionId: string) => {
      const previous = await snapshotSessions();
      queryClient.setQueriesData<SessionListResponse>({ queryKey: ['sessions'] }, (old) =>
        old
          ? { ...old, sessions: old.sessions.filter((s) => s.id !== sessionId), total: Math.max(0, old.total - 1) }
          : old,
      );
      return { previous };
    },
    onError: (_err, _sessionId, context) => rollbackSessions(context),
    onSuccess: () => {
      setSessionToDelete(null);
      if (selectedSession) {
        setSelectedSession(null);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  const handleSessionClick = async (session: { id: string }) => {
    try {
      const sessionDetail = await getSession(session.id);
      setSelectedSession(sessionDetail);
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const handleBackToList = () => {
    setSelectedSession(null);
    setExpandedMessageId(null);
  };

  const handleNavigateToQuery = () => {
    if (selectedSession) {
      navigate('/query', { state: { loadSessionId: selectedSession.id } });
    }
  };

  const toggleExpandMessage = (messageId: number) => {
    setExpandedMessageId(expandedMessageId === messageId ? null : messageId);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const sessions = sessionsData?.sessions || [];
  const totalSessions = sessionsData?.total ?? sessions.length;
  const hasMore = sessions.length < totalSessions;

  const deleteDialog = (
    <Dialog open={!!sessionToDelete} onOpenChange={(o) => !o && setSessionToDelete(null)}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-destructive-border bg-destructive-bg">
              <AlertTriangle className="h-6 w-6 text-destructive-text" />
            </div>
            <div>
              <DialogTitle>Delete Session</DialogTitle>
              <DialogDescription>This will permanently delete this chat session and all its messages.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setSessionToDelete(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => sessionToDelete && deleteMutation.mutate(sessionToDelete)} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Session Detail View
  if (selectedSession) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 pb-6">
        <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-5">
            <Button variant="outline" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{selectedSession.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedSession.messages.length} message{selectedSession.messages.length !== 1 ? 's' : ''}
                <span className="mx-1.5 text-muted-foreground/55">·</span>
                Created {formatDate(selectedSession.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="destructive" onClick={() => setSessionToDelete(selectedSession.id)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <Button onClick={handleNavigateToQuery}>
              <MessageSquare className="h-4 w-4" /> Continue Chat
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          {selectedSession.messages.map((msg) => (
            <Card key={msg.id} className="overflow-hidden">
              <button onClick={() => toggleExpandMessage(msg.id)} className="group flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-foreground/[0.03]">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-info-border bg-info-bg">
                    <MessageSquare className="h-5 w-5 text-info-text" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-base font-medium text-foreground">{msg.question}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground/80">{formatDate(msg.timestamp)}</p>
                  </div>
                  {msg.response.is_valid ? (
                    <Badge variant="default"><Check className="h-3 w-3" /> Valid</Badge>
                  ) : (
                    <Badge variant="destructive"><X className="h-3 w-3" /> Invalid</Badge>
                  )}
                </div>
                <ChevronRight className={`ml-4 h-5 w-5 text-muted-foreground/80 transition-transform duration-300 ${expandedMessageId === msg.id ? 'rotate-90' : ''}`} />
              </button>

              {expandedMessageId === msg.id && (
                <div className="border-t border-border bg-background/40 px-5 pb-5">
                  <div className="space-y-6 pt-5">
                    {msg.response.sql && (
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <Database className="h-4 w-4 text-info-text" />
                          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Generated SQL</span>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-border">
                          <SyntaxHighlighter language="sql" style={isLightTheme ? oneLight : atomDark} customStyle={{ margin: 0, padding: '1rem', fontSize: '0.8rem', background: 'var(--card)' }}>
                            {msg.response.sql}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="rounded-xl border border-border bg-background/60 p-4">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Dialect</p>
                        <p className="mt-1 flex items-center gap-2 text-sm font-medium capitalize text-violet-text">
                          <span className="h-1.5 w-1.5 rounded-full bg-violet-text" />
                          {msg.response.dialect}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/60 p-4">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Tokens Used</p>
                        <p className="mt-1 font-mono text-lg font-bold text-foreground/85">{msg.response.tokens_used}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/60 p-4">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Cached</p>
                        <p className="mt-1 text-sm font-medium">
                          {msg.response.cached ? (
                            <span className="flex items-center gap-1 text-violet-text"><Check className="h-4 w-4" /> Yes</span>
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground/80"><X className="h-4 w-4" /> No</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {msg.response.used_tables && msg.response.used_tables.length > 0 && (
                      <div>
                        <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tables Used</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.response.used_tables.map((table) => (
                            <Badge key={table} variant="info">{table}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {!msg.response.is_valid && (msg.response.validation_errors?.length ?? 0) > 0 && (
                      <div className="rounded-xl border border-destructive-border bg-destructive-bg p-4">
                        <p className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-destructive-text"><AlertTriangle className="h-3.5 w-3.5" /> Validation Errors</p>
                        <ul className="space-y-1">
                          {(msg.response.validation_errors ?? []).map((error, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-destructive-text/90"><span className="text-destructive-text">•</span>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {msg.response.execution_result && msg.response.execution_result.length > 0 && (
                      <div>
                        <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Execution Results <span className="ml-2 font-normal text-muted-foreground/55">({msg.response.execution_result.length} rows)</span>
                        </p>
                        <div className="overflow-x-auto custom-scrollbar rounded-xl border border-border bg-card/60">
                          <table className="w-full text-sm">
                            <thead className="border-b border-border bg-background/70">
                              <tr>
                                {Object.keys(msg.response.execution_result[0]).map((key) => (
                                  <th key={key} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-foreground/85">{key}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {msg.response.execution_result.slice(0, 5).map((row, idx) => (
                                <tr key={idx} className="group transition-colors hover:bg-foreground/5">
                                  {Object.values(row).map((value, vIdx) => (
                                    <td key={vIdx} className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                                      {value !== null && value !== undefined ? (
                                        <span className={typeof value === 'number' ? 'text-violet-text' : 'text-primary/90'}>{String(value)}</span>
                                      ) : (
                                        <span className="italic text-muted-foreground/55">NULL</span>
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {msg.response.execution_result.length > 5 && (
                            <p className="border-t border-border bg-background/60 px-4 py-2.5 font-mono text-[10px] text-muted-foreground/80">
                              +{msg.response.execution_result.length - 5} more rows
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        {deleteDialog}
      </div>
    );
  }

  // Session List View
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-6">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Chat History</h1>
          <p className="mt-1 text-muted-foreground">View your past chat sessions and conversations.</p>
        </div>
        {sessions.length > 0 && (
          <Button variant="destructive" onClick={() => setShowClearConfirm(true)} disabled={clearMutation.isPending}>
            {clearMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Clear All
          </Button>
        )}
      </Card>

      {clearMutation.isError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive-border bg-destructive-bg p-4">
          <AlertCircle className="h-5 w-5 text-destructive-text" />
          <span className="text-destructive-text">{handleApiError(clearMutation.error)}</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="flex items-center gap-4 p-5">
                <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/2 rounded-md" />
                  <Skeleton className="h-4 w-1/3 rounded-md" />
                </div>
                <Skeleton className="h-5 w-5 shrink-0 rounded-md" />
              </div>
            </Card>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No Chat History Yet"
          description="Your chat sessions will appear here once you start asking questions."
        />
      ) : (
        <div ref={sessionsListRef} className="reveal reveal-stagger space-y-3">
          {sessions.map((session) => (
            <Card key={session.id} className="card-lift group overflow-hidden transition-all hover:border-primary/25">
              <div className="flex items-center">
                <button onClick={() => handleSessionClick(session)} className="flex-1 p-5 text-left transition-colors hover:bg-foreground/[0.03]">
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--chart-2)_20%,transparent)] bg-[color-mix(in_srgb,var(--chart-2)_10%,transparent)] transition-all group-hover:shadow-[0_0_15px_color-mix(in_srgb,var(--chart-2)_25%,transparent)]">
                        <MessageSquare className="h-5 w-5 text-[var(--chart-2)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-medium text-foreground transition-colors group-hover:text-info-text">{session.title}</h3>
                        <p className="mt-1 font-mono text-sm text-muted-foreground/80">
                          {session.message_count} message{session.message_count !== 1 ? 's' : ''}
                          <span className="mx-1.5 text-muted-foreground/55">·</span>
                          {formatDate(session.updated_at)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="ml-4 h-5 w-5 text-muted-foreground/55 transition-all group-hover:translate-x-1 group-hover:text-info-text" />
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSessionToDelete(session.id);
                  }}
                  className="border-l border-border p-5 text-muted-foreground/80 transition-colors hover:bg-destructive-bg hover:text-destructive-text"
                  title="Delete session"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </Card>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setLimit((l) => Math.min(l + 50, 200))}
                disabled={isFetching || limit >= 200}
              >
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {limit >= 200
                  ? `Showing first 200 of ${totalSessions}`
                  : `Load more (${sessions.length} of ${totalSessions})`}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Clear All Confirmation */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-destructive-border bg-destructive-bg">
                <AlertTriangle className="h-6 w-6 text-destructive-text" />
              </div>
              <div>
                <DialogTitle>Clear All Sessions</DialogTitle>
                <DialogDescription>
                  This will permanently delete all <strong className="text-destructive-text">{sessions.length}</strong> chat sessions and their messages.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>
              {clearMutation.isPending ? 'Clearing…' : 'Clear All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deleteDialog}
    </div>
  );
};

export default HistoryPage;
