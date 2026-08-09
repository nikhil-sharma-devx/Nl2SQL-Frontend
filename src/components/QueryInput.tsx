import { useState, useEffect, useRef } from 'react';
import { Send, AlertCircle, CornerDownLeft, Zap, SlidersHorizontal, Network, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMagneticHover } from '@/hooks/useMagneticHover';
import { getVisualizeSchema } from '../api/client';
import { getSuggestions } from '../utils/autocomplete';
import DatabaseSelector from './DatabaseSelector';

const dialects = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
];

interface QueryInputProps {
  question: string;
  onQuestionChange: (q: string) => void;
  onSubmit: (dialect: string, execute: boolean) => void;
  onAbort?: () => void;
  isLoading: boolean;
  validationError: string | null;
  onClearValidationError: () => void;
  onToggleQueryBuilder: () => void;
  onToggleGraph: () => void;
  showGraph: boolean;
  messageCount: number;
  execute: boolean;
  onExecuteChange: (v: boolean) => void;
  dialect: string;
  onDialectChange: (v: string) => void;
}

const QueryInput = ({
  question,
  onQuestionChange,
  onSubmit,
  onAbort,
  isLoading,
  validationError,
  onClearValidationError,
  onToggleQueryBuilder,
  onToggleGraph,
  showGraph,
  messageCount,
  execute,
  onExecuteChange,
  dialect,
  onDialectChange,
}: QueryInputProps) => {
  const [schema, setSchema] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submitBtnRef = useMagneticHover<HTMLButtonElement>();

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [question]);

  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const schemaData = await getVisualizeSchema();
        setSchema(schemaData);
      } catch (e) {
        console.error('Failed to load schema for autocomplete:', e);
      }
    };
    fetchSchema();
  }, []);

  // Close suggestions overlay when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTextChange = (val: string) => {
    onQuestionChange(val);
    if (validationError) onClearValidationError();

    if (schema) {
      const list = getSuggestions(val, schema);
      setSuggestions(list);
      setSelectedIndex(-1);
      setShowSuggestions(list.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    onQuestionChange(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && (e.ctrlKey || !e.shiftKey)) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    onSubmit(dialect, execute);
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-3 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative" ref={dropdownRef}>
          <textarea
            ref={textareaRef}
            id="query-input"
            value={question}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Ask a question about your database… e.g. 'Show me all users who signed up last month'"
            className={cn(
              'w-full resize-none rounded-xl border bg-background/60 px-4 py-3.5 text-sm text-foreground shadow-inner transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2',
              validationError
                ? 'border-rose-500/50 focus:border-rose-500/60 focus:ring-rose-500/20'
                : 'border-border focus:border-primary/50 focus:ring-primary/20',
            )}
            style={{ minHeight: '52px' }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (question.trim().length >= 2 && suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            rows={1}
            disabled={isLoading}
            role="combobox"
            aria-expanded={showSuggestions && suggestions.length > 0}
            aria-controls="query-autocomplete-listbox"
            aria-autocomplete="list"
            aria-activedescendant={
              showSuggestions && selectedIndex >= 0
                ? `query-autocomplete-option-${selectedIndex}`
                : undefined
            }
          />

          {/* Autocomplete suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              id="query-autocomplete-listbox"
              role="listbox"
              aria-label="Query suggestions"
              className="absolute left-0 right-0 z-50 bottom-full mb-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-popover/95 p-1.5 shadow-xl backdrop-blur-lg custom-scrollbar"
            >
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  id={`query-autocomplete-option-${idx}`}
                  role="option"
                  aria-selected={idx === selectedIndex}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    'flex w-full items-center rounded-lg px-3 py-2 text-left text-xs text-foreground/90 transition-colors hover:bg-primary/10 hover:text-foreground focus:bg-primary/10 focus:text-foreground focus:outline-none',
                    idx === selectedIndex && 'bg-primary/10 text-foreground font-medium',
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {validationError && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {validationError}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Dialect Selector */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 py-1.5">
              <label htmlFor="dialect-select" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                Dialect
              </label>
              <select
                id="dialect-select"
                value={dialect}
                onChange={(e) => onDialectChange(e.target.value)}
                className="cursor-pointer bg-transparent text-sm font-medium text-foreground focus:outline-none [&>option]:bg-popover [&>option]:text-foreground"
                disabled={isLoading}
              >
                {dialects.map((d) => (
                   <option key={d.value} value={d.value}>
                     {d.label}
                   </option>
                ))}
              </select>
            </div>

            {/* Execute Toggle */}
            <button
              type="button"
              onClick={() => !isLoading && onExecuteChange(!execute)}
              disabled={isLoading}
              aria-pressed={execute}
              className={cn(
                'group flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                execute
                  ? 'border-primary/40 bg-primary/10 text-primary shadow-[0_0_14px_rgba(16,185,129,0.18)]'
                  : 'border-border bg-background/60 text-muted-foreground hover:text-foreground',
              )}
            >
              <Zap className={cn('h-3.5 w-3.5', execute ? 'text-primary' : 'text-muted-foreground/80')} />
              Execute query
              {execute && (
                <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                  on
                </span>
              )}
            </button>

            <span className="font-mono text-[10px] text-muted-foreground/50 whitespace-nowrap">
              {messageCount} msg{messageCount !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1 font-mono text-[10px] text-muted-foreground/55 sm:flex">
              <CornerDownLeft className="h-3 w-3" /> or Ctrl+Enter to send · Shift+Enter newline
            </span>
            <DatabaseSelector />
            <Button
              type="button"
              variant="outline"
              onClick={onToggleGraph}
              disabled={isLoading}
              className={cn(
                'gap-2',
                showGraph
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
                  : 'border-violet-500/20 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300',
              )}
              title="Toggle Schema Graph"
            >
              <Network className="h-4 w-4" />
              <span className="hidden sm:inline">{showGraph ? 'Hide Graph' : 'Show Graph'}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onToggleQueryBuilder}
              disabled={isLoading}
              className="gap-2 border-violet-500/20 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
              title="Open Visual Query Builder"
            >
              <SlidersHorizontal className="h-4 w-4 text-violet-400" />
              <span className="hidden sm:inline">Visual Builder</span>
            </Button>
            {isLoading ? (
              <Button
                type="button"
                onClick={onAbort}
                className="gap-2 px-5 bg-rose-600 hover:bg-rose-700 text-white border-0"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Stop
              </Button>
            ) : (
              <Button
                ref={submitBtnRef}
                id="submit-query-btn"
                type="submit"
                disabled={question.trim().length < 3}
                className="px-5"
              >
                <Send className="h-4 w-4" />
                Submit
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default QueryInput;
