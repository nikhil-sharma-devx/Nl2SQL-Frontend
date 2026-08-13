/**
 * ChatWindow — renders the full message thread.
 *
 * Displays user questions and assistant responses including SQL previews,
 * result tables, validation errors, and schema info. (Logic unchanged; restyled.)
 */
import { useState, useRef, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { standardTransition } from '@/motion/variants';
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
  Pencil,
  RefreshCw,
  HelpCircle,
  LayoutDashboard,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AiOrb from './AiOrb';
import SqlPreview from './SqlPreview';
import ResultTable from './ResultTable';
import FeedbackPanel from './FeedbackPanel';
import AddToDashboardModal from './AddToDashboardModal';
// recharts is heavy — load it only when a message actually has a chart
const DataChart = lazy(() => import('./DataChart'));
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { createSavedQuery, type WidgetInput } from '../api/client';
import { guessChartConfig } from '../utils/chart';
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
  onCorrection?: (correctionText: string) => void | Promise<void>;
  onEditQuestion?: (messageId: number, newText: string) => void | Promise<void>;
  onRegenerate?: (messageId: number) => void | Promise<void>;
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
  onCorrection,
  onEditQuestion,
  onRegenerate,
}: ChatWindowProps) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const reducedMotion = useReducedMotion();
  // Only stagger the batch of messages already present on mount (e.g. a
  // loaded session history) — live-appended messages get an immediate,
  // un-delayed entrance so real-time chat never feels laggy.
  const initialCountRef = useRef(messages.length);

  const startEdit = (messageId: number, current: string) => {
    setEditingId(messageId);
    setEditText(current);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };
  const saveEdit = async (messageId: number) => {
    const trimmed = editText.trim();
    cancelEdit();
    if (trimmed) await onEditQuestion?.(messageId, trimmed);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-6 overflow-y-auto custom-scrollbar pr-1">
      {messages.map((msg, index) => {
        const isInitialBatch = index < initialCountRef.current;
        const delay = reducedMotion || !isInitialBatch ? 0 : Math.min(index, 6) * 0.07;
        return (
        <motion.div
          key={msg.id}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: reducedMotion ? { duration: 0.15 } : { ...standardTransition, delay } }}
          className="space-y-4"
        >
          {/* User Question */}
          <div className="group flex flex-col items-end">
            <div className="chat-bubble chat-bubble-user max-w-[80%] px-5 py-3 text-foreground">
              {editingId === msg.id ? (
                <div className="flex w-full min-w-[240px] flex-col gap-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    autoFocus
                    className="w-full resize-y rounded-md border border-primary/30 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 px-2 text-xs">
                      <X className="h-3.5 w-3.5" /> Cancel
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => saveEdit(msg.id)} className="h-7 px-2 text-xs">
                      <Check className="h-3.5 w-3.5" /> Send
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm leading-relaxed">{msg.question}</p>
                  <span className="mt-1.5 block font-mono text-[10px] text-foreground/50">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
            </div>
            {editingId !== msg.id && onEditQuestion && (
              <button
                onClick={() => startEdit(msg.id, msg.question)}
                title="Edit and resend this question"
                className="mt-1 flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
          </div>

          {/* AI Response or Direct SQL */}
          <div className="flex justify-start gap-3">
            <div className={cn(
              "mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex",
              msg.response.intent_type === 'direct_sql'
                ? "border border-info-border bg-info-bg text-info-text"
                : "bg-gradient-to-br from-primary to-[color-mix(in_srgb,var(--primary)_55%,white)] text-primary-foreground shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_50%,transparent),0_0_6px_color-mix(in_srgb,var(--primary)_30%,transparent)]"
            )}>
              {msg.response.intent_type === 'direct_sql' ? (
                <SlidersHorizontal className="h-4 w-4" />
              ) : (
                <TerminalSquare className="h-4 w-4" />
              )}
            </div>
            <div className="chat-bubble chat-bubble-ai holo-border w-full max-w-[90%] px-5 py-4">
              {msg.response.intent_type === 'direct_sql' && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="info" className="font-mono text-[10px] font-bold uppercase tracking-wider">
                    Direct SQL Query
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground/60">(Visual Builder Execution)</span>
                </div>
              )}
              {/* Clarification request for an ambiguous follow-up — answer inline to continue */}
              {msg.response.needs_clarification && (
                <div className="mb-4 flex items-start gap-2 rounded-md border border-info-border bg-info-bg px-4 py-3 text-sm text-info-text">
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{msg.response.clarification_prompt || msg.response.message}</span>
                </div>
              )}

              {/* Assistant message: amber warning for empty results, plain text for greetings */}
              {msg.response.message && !msg.response.needs_clarification && (
                msg.response.execution_result !== null && msg.response.execution_result !== undefined ? (
                  <div className="mb-4 flex items-start gap-2 rounded-md border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-text">
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

              {/* Data Chart — prefer the model's suggestion, else infer one from
                  the result rows so graphable answers still chart (manual Run,
                  cached responses, or when the model returned no chart). */}
              {(() => {
                const chartRows = editedResults?.[msg.id]?.results || msg.response.execution_result || [];
                if (!chartRows.length) return null;
                const llmChart = msg.response.suggested_chart as
                  | { type?: string; x_axis?: string; y_axis?: string }
                  | null
                  | undefined;
                const chartCfg =
                  llmChart && llmChart.type && llmChart.type !== 'none'
                    ? llmChart
                    : guessChartConfig(chartRows);
                if (!chartCfg || !chartCfg.type || chartCfg.type === 'none') return null;
                return (
                  <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
                    <DataChart
                      data={chartRows}
                      config={chartCfg as { type: string; x_axis: string; y_axis: string }}
                    />
                  </Suspense>
                );
              })()}

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
                        className="max-w-full cursor-pointer truncate rounded-full border border-border bg-foreground/[0.03] px-3 py-1.5 text-left text-xs text-foreground/85 transition-all duration-200 hover:border-primary/40 hover:bg-primary/12 hover:text-primary hover:shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_15%,transparent)]"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback + Save + Add to dashboard */}
              {msg.response.sql && msg.response.is_valid && (
                <div className="flex items-center gap-2">
                  <FeedbackPanel question={msg.question} generatedSql={msg.response.sql} onSubmit={onFeedback} onCorrection={onCorrection} />
                  <SaveQueryButton question={msg.question} sql={msg.response.sql} />
                  <AddToDashboardButton
                    question={msg.question}
                    sql={msg.response.sql}
                    rows={editedResults?.[msg.id]?.results || msg.response.execution_result || []}
                    suggestedChart={msg.response.suggested_chart}
                  />
                </div>
              )}

              {/* Regenerate / Retry — re-run the same question through the chat flow */}
              {onRegenerate && msg.response.intent_type !== 'direct_sql' && !msg.response.needs_clarification && (
                <div className="mt-3">
                  <button
                    onClick={() => onRegenerate(msg.id)}
                    disabled={isLoading}
                    title={msg.response.is_valid ? 'Regenerate this answer' : 'Retry this question'}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {msg.response.is_valid ? 'Regenerate' : 'Retry'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
        );
      })}

      {/* Optimistic user bubble — shown immediately on submit */}
      {pendingQuestion && (
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: reducedMotion ? { duration: 0.15 } : standardTransition }}
          className="space-y-4"
        >
          <div className="flex justify-end">
            <div className="chat-bubble chat-bubble-user max-w-[80%] px-5 py-3 text-foreground">
              <p className="text-sm leading-relaxed">{pendingQuestion}</p>
              <span className="mt-1.5 block font-mono text-[10px] text-foreground/50">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {messages.length === 0 && !isLoading && !pendingQuestion && (
        <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/35 bg-primary/12 shadow-[0_0_44px_color-mix(in_srgb,var(--primary)_35%,transparent),0_0_16px_color-mix(in_srgb,var(--primary)_20%,transparent)] animate-pulse-glow">
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
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: reducedMotion ? { duration: 0.15 } : standardTransition }}
          className="flex justify-start gap-3"
        >
          <div className="mt-1 hidden sm:flex">
            <AiOrb size="sm" />
          </div>
          <div className="chat-bubble chat-bubble-ai holo-border w-full max-w-[90%] px-5 py-4">
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
        </motion.div>
      )}

      {/* Rate Limit Error */}
      {rateLimitError && (
        <div className="flex justify-start">
          <div className="chat-bubble max-w-[80%] rounded-2xl rounded-tl-sm border border-warning-border bg-warning-bg px-5 py-4 backdrop-blur-md">
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
          <div className="chat-bubble max-w-[80%] rounded-2xl rounded-tl-sm border border-destructive-border bg-destructive-bg px-5 py-4 backdrop-blur-md">
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

function AddToDashboardButton({
  question,
  sql,
  rows,
  suggestedChart,
}: {
  question: string;
  sql: string;
  rows: any[];
  suggestedChart?: { type?: string; x_axis?: string; y_axis?: string } | null;
}) {
  const [open, setOpen] = useState(false);

  // Derive the widget's chart config: prefer the model's suggestion, else infer
  // from the result rows, else fall back to a plain table widget.
  const effective =
    suggestedChart && suggestedChart.type && suggestedChart.type !== 'none'
      ? suggestedChart
      : guessChartConfig(rows);
  const widget: WidgetInput = {
    title: question.slice(0, 200),
    nl_prompt: question,
    sql,
    chart_type: effective?.type ?? 'table',
    chart_config: effective ? { x_axis: effective.x_axis, y_axis: effective.y_axis } : null,
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Add this result to a dashboard"
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
      >
        <LayoutDashboard size={13} />
        Dashboard
      </button>
      <AddToDashboardModal open={open} onOpenChange={setOpen} widget={widget} />
    </>
  );
}

export default ChatWindow;
