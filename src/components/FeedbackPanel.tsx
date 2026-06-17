/**
 * FeedbackPanel — Collects user feedback on query results.
 * (Logic unchanged; restyled to the dark system.)
 */
import { useState } from 'react';
import { ThumbsUp, ThumbsDown, X, AlertTriangle, MessageSquare, Check } from 'lucide-react';

interface FeedbackPanelProps {
  question: string;
  generatedSql: string;
  onSubmit?: (feedback: FeedbackData) => void;
}

interface FeedbackData {
  question: string;
  generated_sql: string;
  feedback_type: 'positive' | 'negative';
  error_type?: string;
  user_correction?: string;
  user_notes?: string;
}

const ERROR_CATEGORIES = [
  { value: 'wrong_column', label: 'Wrong/Non-existent Column' },
  { value: 'missing_join', label: 'Missing JOIN' },
  { value: 'wrong_aggregation', label: 'Incorrect Aggregation' },
  { value: 'syntax_error', label: 'SQL Syntax Error' },
  { value: 'wrong_filter', label: 'Incorrect WHERE/Filter' },
  { value: 'other', label: 'Other' },
];

const FeedbackPanel = ({ question, generatedSql, onSubmit }: FeedbackPanelProps) => {
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);
  const [showErrorReport, setShowErrorReport] = useState(false);
  const [errorType, setErrorType] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [userCorrection, setUserCorrection] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handlePositiveFeedback = () => {
    setFeedbackGiven('positive');
    setSubmitted(true);
    onSubmit?.({ question, generated_sql: generatedSql, feedback_type: 'positive' });
    setTimeout(() => setFeedbackGiven(null), 2000);
  };

  const handleNegativeFeedback = () => {
    setFeedbackGiven('negative');
    setShowErrorReport(true);
  };

  const handleSubmitErrorReport = () => {
    if (!errorType) return;
    setSubmitted(true);
    setShowErrorReport(false);
    onSubmit?.({
      question,
      generated_sql: generatedSql,
      feedback_type: 'negative',
      error_type: errorType,
      user_correction: userCorrection || undefined,
      user_notes: userNotes || undefined,
    });
    setTimeout(() => {
      setFeedbackGiven(null);
      setSubmitted(false);
      setErrorType('');
      setUserNotes('');
      setUserCorrection('');
    }, 2000);
  };

  if (submitted) {
    return (
      <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 p-3">
        <Check className="h-4 w-4 text-primary" />
        <p className="text-sm text-primary">Thank you for your feedback!</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {!showErrorReport && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Was this query helpful?</span>
          <button
            onClick={handlePositiveFeedback}
            disabled={feedbackGiven === 'positive'}
            className="flex items-center gap-2 rounded-lg border border-border bg-foreground/[0.03] px-3 py-1.5 text-sm font-medium text-foreground/85 transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
          >
            <ThumbsUp className="h-4 w-4" />
            Yes
          </button>
          <button
            onClick={handleNegativeFeedback}
            disabled={feedbackGiven === 'negative'}
            className="flex items-center gap-2 rounded-lg border border-border bg-foreground/[0.03] px-3 py-1.5 text-sm font-medium text-foreground/85 transition-colors hover:border-destructive-border/40 hover:bg-destructive-bg hover:text-destructive-text"
          >
            <ThumbsDown className="h-4 w-4" />
            No
          </button>
        </div>
      )}

      {showErrorReport && (
        <div className="space-y-4 rounded-xl border border-destructive-border bg-destructive-bg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive-text" />
              <span className="text-sm font-semibold text-destructive-text">Report Error</span>
            </div>
            <button onClick={() => setShowErrorReport(false)} className="text-muted-foreground transition-colors hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">What went wrong?</label>
            <select
              value={errorType}
              onChange={(e) => setErrorType(e.target.value)}
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground focus:border-destructive-border/50 focus:outline-none focus:ring-2 focus:ring-destructive-border/20 [&>option]:bg-popover"
            >
              <option value="">Select error type…</option>
              {ERROR_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Correct SQL (optional)</label>
            <textarea
              value={userCorrection}
              onChange={(e) => setUserCorrection(e.target.value)}
              placeholder="Paste the correct SQL if you know it…"
              className="min-h-[80px] w-full resize-y rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-sm text-foreground focus:border-destructive-border/50 focus:outline-none focus:ring-2 focus:ring-destructive-border/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional Notes (optional)</label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/80" />
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Describe the issue…"
                className="min-h-[60px] w-full resize-y rounded-lg border border-border bg-background/60 py-2 pl-10 pr-3 text-sm text-foreground focus:border-destructive-border/50 focus:outline-none focus:ring-2 focus:ring-destructive-border/20"
              />
            </div>
          </div>

          <button
            onClick={handleSubmitErrorReport}
            disabled={!errorType}
            className="w-full rounded-lg bg-destructive-bg px-4 py-2 text-sm font-medium text-destructive-text transition-colors hover:bg-destructive-text/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Submit Feedback
          </button>
        </div>
      )}
    </div>
  );
};

export default FeedbackPanel;
