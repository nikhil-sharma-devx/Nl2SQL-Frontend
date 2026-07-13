/**
 * ChatWindow — renders the full message thread.
 *
 * Displays user questions and assistant responses including SQL previews,
 * result tables, validation errors, and schema info. (Logic unchanged; restyled.)
 */
import { useState, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Table2,
  Clock,
  RotateCcw,
  TerminalSquare,
  Check,
  BrainCircuit,
  SlidersHorizontal,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import SqlPreview from './SqlPreview';
import ResultTable from './ResultTable';
import FeedbackPanel from './FeedbackPanel';
// recharts is heavy — load it only when a message actually has a chart
const DataChart = lazy(() => import('./DataChart'));
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createSavedQuery } from '../api/client';
import type { ChatMessage } from '../types/query.types';

interface ChatWindowProps {
  messages: ChatMessage[];
  pendingQuestion?: string | null;
  loadingText?: string | null;
  thinkingSteps?: { stage: string; label: string; detail?: string }[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  execute: boolean;
  rateLimitError: {
    message: string;
    retryAfter: number;
    lastQuestion: string;
    lastExecute: boolean;
  } | null;
  onRetry: () => void;
  handleApiError: (error: unknown) => string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onSuggestionClick?: (suggestion: string) => void;
  onSqlExecuted?: (messageId: number, sql: string, results: any) => void;
  editedResults?: Record<number, any>;
  onFeedback?: (feedback: any) => void;
}

const ChatWindow = ({
  messages,
  pendingQuestion,
  loadingText,
  thinkingSteps,
  isLoading,
  isError,
  error,
  execute,
  rateLimitError,
  onRetry,
  handleApiError,
  messagesEndRef,
  onSuggestionClick,
  onSqlExecuted,
  editedResults,
  onFeedback,
}: ChatWindowProps) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-6 overflow-y-auto custom-scrollbar pr-1">
      {messages.map((msg) => (
        <div key={msg.id} className="animate-slide-up space-y-4">
          {/* User Question */}
          <div className="flex justify-end">
            <div className="chat-bubble chat-bubble-user max-w-[80%] px-5 py-3 text-foreground shadow-[0_8px_32px_-12px_rgba(16,185,129,0.25)]">
              <p className="text-sm leading-relaxed">{msg.question}</p>
              <span className="mt-1.5 block font-mono text-[10px] text-foreground/50">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* AI Response or Direct SQL */}
          <div className="flex justify-start gap-3">
            <div className={cn(
              "mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex",
              msg.response.intent_type === 'direct_sql'
                ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-[0_0_16px_rgba(124,58,237,0.4)]"
                : "bg-gradient-to-br from-primary to-emerald-400 text-primary-foreground shadow-[0_0_18px_rgba(16,185,129,0.5),0_0_6px_rgba(16,185,129,0.3)]"
            )}>
              {msg.response.intent_type === 'direct_sql' ? (
                <SlidersHorizontal className="h-4 w-4" />
              ) : (
                <TerminalSquare className="h-4 w-4" />
              )}
            </div>
            <div className="chat-bubble chat-bubble-ai w-full max-w-[90%] px-5 py-4">
              {msg.response.intent_type === 'direct_sql' && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-400 font-mono text-[10px] font-bold uppercase tracking-wider">
                    Direct SQL Query
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground/60">(Visual Builder Execution)</span>
                </div>
              )}
              {/* Assistant message: amber warning for empty results, plain text for greetings */}
              {msg.response.message && (
                msg.response.execution_result !== null && msg.response.execution_result !== undefined ? (
                  <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                    <span className="mt-0.5 shrink-0">⚠</span>
                    <span>{msg.response.message}</span>
                  </div>
                ) : (
                  <div className="mb-4 leading-relaxed text-foreground/85">{msg.response.message}</div>
                )
              )}

              {/* SQL Preview */}
              <SqlPreview
                response={msg.response}
                messageId={msg.id}
                onSuggestionsLoaded={(suggestions) => {
                  console.log('Suggestions loaded for message:', msg.id, suggestions);
                }}
                onSqlExecuted={(result) => {
                  onSqlExecuted?.(msg.id, result.sql, result);
                }}
                onSuggestionClick={(suggestion) => {
                  onSuggestionClick?.(suggestion);
                }}
              />

              {/* Validation Errors */}
              {!msg.response.is_valid && (msg.response.validation_errors?.length ?? 0) > 0 && (
                <div className="mb-4 rounded-xl border border-destructive-border bg-destructive-bg p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive-text" />
                    <span className="text-sm font-semibold text-destructive-text">Validation Errors</span>
                  </div>
                  <ul className="space-y-1">
                    {(msg.response.validation_errors ?? []).map((err, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-destructive-text/90">
                        <span className="text-destructive-text">•</span>
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Used Tables */}
              {msg.response.used_tables && msg.response.used_tables.length > 0 && (
                <div className="mb-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-info-text" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tables Used</span>
                    <span className="font-mono text-[10px] text-muted-foreground/55">(in SQL query)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {msg.response.used_tables.map((table) => (
                      <Badge key={table} variant="info">{table}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Chart */}
              {msg.response.suggested_chart && msg.response.suggested_chart.type !== 'none' && (
                <Suspense fallback={<div className="h-40 animate-pulse rounded-xl border border-border bg-card/40 motion-reduce:animate-none" />}>
                  <DataChart
                    data={editedResults?.[msg.id]?.results || msg.response.execution_result || []}
                    config={msg.response.suggested_chart as { type: string; x_axis: string; y_axis: string }}
                  />
                </Suspense>
              )}

              {/* Execution Results */}
              <ResultTable response={msg.response} editedResult={editedResults?.[msg.id]} />

              {/* Follow Up Questions */}
              {msg.response.follow_up_questions && msg.response.follow_up_questions.length > 0 && (
                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                    Suggested Follow-ups
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {msg.response.follow_up_questions.map((q: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => onSuggestionClick?.(q)}
                        className="max-w-full cursor-pointer truncate rounded-full border border-border bg-foreground/[0.03] px-3 py-1.5 text-left text-xs text-foreground/85 transition-all duration-200 hover:border-primary/40 hover:bg-primary/12 hover:text-primary hover:shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback + Save */}
              {msg.response.sql && msg.response.is_valid && (
                <div className="flex items-center gap-2">
                  <FeedbackPanel question={msg.question} generatedSql={msg.response.sql} onSubmit={onFeedback} />
                  <SaveQueryButton question={msg.question} sql={msg.response.sql} />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Optimistic user bubble — shown immediately on submit */}
      {pendingQuestion && (
        <div className="animate-slide-up space-y-4">
          <div className="flex justify-end">
            <div className="chat-bubble chat-bubble-user max-w-[80%] px-5 py-3 text-foreground shadow-[0_8px_32px_-12px_rgba(16,185,129,0.25)]">
              <p className="text-sm leading-relaxed">{pendingQuestion}</p>
              <span className="mt-1.5 block font-mono text-[10px] text-foreground/50">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {messages.length === 0 && !isLoading && !pendingQuestion && (
        <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/35 bg-primary/12 shadow-[0_0_44px_rgba(16,185,129,0.35),0_0_16px_rgba(16,185,129,0.2)] animate-pulse-glow">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mb-3 font-display text-2xl font-semibold tracking-tight text-gradient-hero">Ask anything about your data</h3>
          <p className="max-w-md leading-relaxed text-muted-foreground">
            Type a natural-language question and I'll generate SQL for you. Every message in this session is saved together.
          </p>
        </div>
      )}

      {/* Loading / Thinking State */}
      {isLoading && (
        <div className="flex animate-slide-up justify-start gap-3">
          <div className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-400 text-primary-foreground shadow-[0_0_18px_rgba(16,185,129,0.5),0_0_6px_rgba(16,185,129,0.3)] sm:flex">
            <TerminalSquare className="h-4 w-4" />
          </div>
          <div className="w-full max-w-[90%] rounded-2xl rounded-tl-sm border border-border bg-card/70 px-5 py-4 shadow-lg backdrop-blur-md">
            <div className="mb-3 flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-primary" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Thinking
              </span>
            </div>
            <ol className="space-y-2.5">
              {(thinkingSteps && thinkingSteps.length > 0
                ? thinkingSteps
                : [{ stage: 'init', label: loadingText || (execute ? 'Generating and executing SQL…' : 'Generating SQL…') }]
              ).map((step, i, arr) => {
                const isActive = i === arr.length - 1;
                return (
                  <li key={step.stage} className="flex items-center gap-2.5 text-sm">
                    {isActive ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
                        <Check className="h-3 w-3 text-primary" />
                      </span>
                    )}
                    <span className={isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}>{step.label}</span>
                    {step.detail && (
                      <span className="font-mono text-[11px] text-muted-foreground/70">· {step.detail}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      {/* Rate Limit Error */}
      {rateLimitError && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-warning-border bg-warning-bg px-5 py-4 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning-text" />
              <div className="flex-1">
                <div className="mb-2 font-semibold text-warning-text">Rate Limit Exceeded</div>
                <p className="mb-3 text-sm text-warning-text/90">{rateLimitError.message}</p>
                <Button variant="outline" onClick={onRetry} disabled={isLoading} className="border-warning-border/40 text-warning-text hover:bg-warning-bg/40">
                  <RotateCcw className="h-4 w-4" />
                  Retry Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && !rateLimitError && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-destructive-border bg-destructive-bg px-5 py-4 backdrop-blur-md">
            <div className="mb-2 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive-text" />
              <span className="font-semibold text-destructive-text">Error</span>
            </div>
            <p className="text-sm text-destructive-text/90">{handleApiError(error)}</p>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

function SaveQueryButton({ question, sql }: { question: string; sql: string }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    if (saved || saving) return;
    setSaving(true);
    setError(false);
    try {
      await createSavedQuery({ nl_prompt: question, generated_sql: sql });
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['saved-queries'] });
    } catch {
      setError(true);
      setTimeout(() => setError(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      onClick={handleSave}
      disabled={saving || saved}
      title={error ? 'Failed to save — try again' : saved ? 'Saved to Saved Queries' : 'Save this query'}
      className={cn(
        'flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
        saved
          ? 'border-primary/40 bg-primary/10 text-primary'
          : error
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
      )}
    >
      {saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
      {error ? 'Failed' : saved ? 'Saved' : 'Save'}
    </button>
  );
}

export default ChatWindow;
