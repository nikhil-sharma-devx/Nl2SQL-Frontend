/**
 * SharedQueryView — public page for a shared query link (/shared/:token).
 *
 * Fetches the token-authed snapshot from the public GET endpoint and renders
 * the question, SQL, and result table. No auth is required; expired/revoked or
 * unknown links surface a friendly message.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, AlertTriangle, TerminalSquare } from 'lucide-react';
import ResultTable from '../components/ResultTable';
import { getSharedQuery, type SharedSnapshot } from '../api/client';
import type { QueryResponse } from '../types/query.types';

const SharedQueryView = () => {
  const { token } = useParams<{ token: string }>();
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    getSharedQuery(token)
      .then((snap) => {
        if (active) setSnapshot(snap);
      })
      .catch((err) => {
        if (!active) return;
        const status = err?.status;
        setError(
          status === 410
            ? 'This share link has expired or was revoked.'
            : status === 404
              ? 'This share link is invalid.'
              : 'Could not load this shared query.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center gap-2">
          <TerminalSquare className="h-5 w-5 text-primary" />
          <span className="font-display text-lg font-semibold">Vectrix — Shared Query</span>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive-border bg-destructive-bg p-4 text-sm text-destructive-text">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>{error}</p>
              <Link to="/" className="mt-2 inline-block text-primary hover:underline">
                Go to Vectrix
              </Link>
            </div>
          </div>
        )}

        {!loading && snapshot && (
          <div className="space-y-6">
            {snapshot.question && (
              <div>
                <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Question
                </p>
                <p className="text-lg text-foreground/90">{snapshot.question}</p>
              </div>
            )}

            <div>
              <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                SQL
              </p>
              <pre className="overflow-x-auto custom-scrollbar rounded-xl border border-border bg-card/60 p-4 font-mono text-xs text-primary/90">
                {snapshot.sql}
              </pre>
            </div>

            <ResultTable
              response={
                {
                  question: snapshot.question,
                  sql: snapshot.sql,
                  execution_result: snapshot.results,
                } as unknown as QueryResponse
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedQueryView;
