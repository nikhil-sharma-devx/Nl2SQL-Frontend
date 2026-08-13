/**
 * SqlPreview — displays generated SQL with syntax highlighting.
 * (Logic unchanged; restyled with shadcn primitives.)
 */
import { useState, useEffect, lazy, Suspense } from 'react';
import { Check, X, Zap, Copy, Loader2, BookOpen, Send, Lightbulb, Gauge, AlertTriangle, Info } from 'lucide-react';
import type { QueryResponse } from '../types/query.types';
import { explainSQL, getSuggestions, saveSQLVersion, executeSQL, getSQLVersions, previewSQL } from '../api/client';
import type { QueryPreviewResponse } from '../api/client';
import type { SQLVersion } from './VersionedSQLDisplay';

// react-syntax-highlighter is heavy — load it with the first SQL block
const VersionedSQLDisplay = lazy(() => import('./VersionedSQLDisplay'));
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ExportShareControls from './ExportShareControls';

interface SqlPreviewProps {
  response: QueryResponse;
  messageId?: number;
  onSuggestionsLoaded?: (suggestions: string[]) => void;
  onSqlExecuted?: (results: any) => void;
  onSuggestionClick?: (suggestion: string) => void;
  onVersionSaved?: (version: SQLVersion) => void;
}

const SqlPreview = ({ response, messageId, onSuggestionsLoaded, onSqlExecuted, onSuggestionClick, onVersionSaved }: SqlPreviewProps) => {
  const [copied, setCopied] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanation, setExplanation] = useState<string>('');
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [versions, setVersions] = useState<SQLVersion[]>([
    {
      version: 1,
      sql: response.sql,
      results: undefined,
      timestamp: new Date(),
      isOriginal: true,
    },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [preview, setPreview] = useState<QueryPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!messageId) return;
    // Optimistic/not-yet-persisted messages carry a client timestamp id
    // (Date.now()) that overflows the DB's 32-bit message id — they can't have
    // saved versions yet, so skip the fetch entirely.
    if (messageId > 2_147_483_647) return;
    getSQLVersions(messageId)
      .then((data) => {
        if (!data.versions || data.versions.length === 0) return;
        const original: SQLVersion = {
          version: 1,
          sql: response.sql,
          results: (response.execution_result as any) ?? undefined,
          timestamp: new Date(),
          isOriginal: true,
        };
        const edited = data.versions.map((v, i) => ({
          version: i + 2,
          sql: v.sql,
          results: v.results,
          timestamp: new Date(v.timestamp as unknown as string),
          isOriginal: false,
        }));
        setVersions([original, ...edited]);
      })
      .catch(() => {});
  }, [messageId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!response.sql) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(response.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy SQL:', err);
    }
  };

  const handleExplain = async () => {
    if (explanation) {
      setShowExplanation(!showExplanation);
      return;
    }
    setLoadingExplanation(true);
    try {
      const result = await explainSQL(response.sql);
      setExplanation(result.explanation);
      setShowExplanation(true);
    } catch (error) {
      console.error('Failed to get explanation:', error);
      setExplanation('Failed to load explanation.');
      setShowExplanation(true);
    } finally {
      setLoadingExplanation(false);
    }
  };

  const handleReRunVersion = async (sql: string, _versionIndex: number) => {
    setIsRunning(true);
    try {
      const result = await executeSQL({ sql });
      if (result.success) {
        const newVersion: SQLVersion = {
          version: versions.length + 1,
          sql,
          results: result.results || undefined,
          timestamp: new Date(),
          isOriginal: false,
        };
        const updatedVersions = [...versions, newVersion];
        setVersions(updatedVersions);
        if (messageId) {
          await saveSQLVersion({
            message_id: messageId,
            sql,
            results: result.results || undefined,
            success: true,
          });
        }
        onVersionSaved?.(newVersion);
        onSqlExecuted?.(result);
      }
    } catch (error) {
      console.error('Failed to execute SQL:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const handlePreview = async () => {
    if (preview) {
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    try {
      const result = await previewSQL(response.sql);
      setPreview(result);
    } catch (error) {
      console.error('Failed to preview SQL cost:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleLoadSuggestions = async () => {
    if (suggestions.length > 0) return;
    setLoadingSuggestions(true);
    try {
      const result = await getSuggestions({
        original_question: response.question,
        generated_sql: response.sql,
        retrieved_tables: response.retrieved_tables,
      });
      setSuggestions(result.suggestions);
      onSuggestionsLoaded?.(result.suggestions);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <div>
      {/* Versioned SQL Display */}
      <div className="mb-4">
        <Suspense fallback={<Skeleton className="h-24 rounded-xl" />}>
          <VersionedSQLDisplay versions={versions} onReRun={handleReRunVersion} isRunning={isRunning} />
        </Suspense>
      </div>

      {/* Action Buttons */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {copied ? <><Check className="h-4 w-4 text-primary" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy SQL</>}
        </Button>

        <Button
          size="sm"
          onClick={handleExplain}
          disabled={loadingExplanation}
          className="border border-info-border bg-info-bg text-info-text shadow-none hover:bg-info-text/20"
        >
          {loadingExplanation ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Explaining…</>
          ) : (
            <><BookOpen className="h-4 w-4" /> {showExplanation ? 'Hide' : 'Show'} Explanation</>
          )}
        </Button>

        <Button
          size="sm"
          onClick={handleLoadSuggestions}
          disabled={loadingSuggestions || suggestions.length > 0}
          className="border border-warning-border bg-warning-bg text-warning-text shadow-none hover:bg-warning-text/20"
        >
          {loadingSuggestions ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
          ) : suggestions.length > 0 ? (
            <><Check className="h-4 w-4" /> Suggestions Loaded</>
          ) : (
            <><Lightbulb className="h-4 w-4" /> Get Suggestions</>
          )}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={handlePreview}
          disabled={loadingPreview}
        >
          {loadingPreview ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Estimating…</>
          ) : (
            <><Gauge className="h-4 w-4" /> {preview ? 'Hide' : 'Preview'} Cost</>
          )}
        </Button>

        {/* Export (CSV/JSON/SQL/PDF) + Share (secure link, email, Slack) */}
        <ExportShareControls response={response} />
      </div>

      {/* Validation Status + Cache + Tokens */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {response.is_valid ? (
          <Badge variant="default"><Check className="h-3 w-3" /> Valid SQL</Badge>
        ) : (
          <Badge variant="destructive"><X className="h-3 w-3" /> Invalid SQL</Badge>
        )}

        {response.cached && (
          <Badge variant="violet"><Zap className="h-3 w-3" /> Cached</Badge>
        )}

        <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-muted-foreground">
          <span className="font-bold text-foreground">{response.tokens_used}</span> TOKENS
        </span>
      </div>

      {/* SQL Explanation */}
      {showExplanation && explanation && (
        <div className="mt-4 rounded-xl border border-info-border bg-info-bg p-4">
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-info-text" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-info-text">SQL Explanation</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{explanation}</p>
        </div>
      )}

      {/* Query Cost / Row-Count Preview */}
      {preview && (
        preview.supported ? (
          <div className="mt-4 rounded-xl border border-info-border bg-info-bg p-4">
            <div className="mb-3 flex items-center gap-2">
              <Gauge className="h-4 w-4 text-info-text" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-info-text">Query Cost Preview</span>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <Badge variant="info">
                Est. rows: <span className="font-bold">{(preview.estimated_rows ?? 0).toLocaleString()}</span>
              </Badge>
              <Badge variant="violet">
                Est. cost: <span className="font-bold">{(preview.estimated_cost ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </Badge>
            </div>
            {preview.warnings.length > 0 ? (
              <div className="flex flex-col gap-2">
                {preview.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg p-2.5 text-sm text-warning-text"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-foreground/70">
                <Check className="h-4 w-4 text-primary" /> No performance warnings detected.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{preview.message || 'Query preview is not supported on this database.'}</span>
          </div>
        )
      )}

      {/* Suggested Follow-up Questions */}
      {suggestions.length > 0 && (
        <div className="mt-4 rounded-xl border border-warning-border bg-warning-bg p-4">
          <div className="mb-3 flex items-center gap-2">
            <Send className="h-4 w-4 text-warning-text" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-warning-text">Suggested Follow-up Questions</span>
          </div>
          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="w-full cursor-pointer rounded-lg border border-warning-border/30 bg-background/40 p-3 text-left text-sm text-foreground/85 transition-all hover:border-warning-border hover:bg-warning-bg/40"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SqlPreview;
