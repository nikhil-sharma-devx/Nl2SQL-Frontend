/**
 * VersionedSQLDisplay — ChatGPT-style version toggle for edited SQL.
 * (Logic unchanged; restyled.)
 */
import { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChevronLeft, ChevronRight, Pencil, Play, Check, X, Code2, Copy } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export interface SQLVersion {
  version: number;
  sql: string;
  results?: any;
  timestamp: Date;
  isOriginal: boolean;
}

interface VersionedSQLDisplayProps {
  versions: SQLVersion[];
  onReRun?: (sql: string, versionIndex: number) => void;
  isRunning?: boolean;
}

const VersionedSQLDisplay = ({ versions, onReRun, isRunning }: VersionedSQLDisplayProps) => {
  const { theme } = useTheme();
  const isLightTheme = theme === 'light' || theme === 'claude';
  const highlighterStyle = isLightTheme ? oneLight : atomDark;
  const [currentIndex, setCurrentIndex] = useState(versions.length - 1);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSql, setEditedSql] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCurrentIndex(versions.length - 1);
  }, [versions.length]);

  const currentVersion = versions[currentIndex];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentVersion?.sql ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  const totalVersions = versions.length;

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsEditing(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalVersions - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsEditing(false);
    }
  };

  const handleEdit = () => {
    setEditedSql(currentVersion.sql);
    setIsEditing(true);
  };

  const handleReRun = async () => {
    if (onReRun && editedSql.trim()) {
      await onReRun(editedSql, currentIndex);
      setIsEditing(false);
    }
  };

  return (
    <div className="holo-border overflow-hidden rounded-xl border border-border bg-background/60 backdrop-blur-md">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-foreground/[0.03] px-3 py-2">
        <div className="flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">SQL</span>
        </div>

        <div className="flex items-center gap-1.5">
          {totalVersions > 1 && (
            <>
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="rounded-md p-1 text-muted-foreground transition-colors enabled:hover:bg-foreground/10 enabled:hover:text-foreground disabled:cursor-not-allowed disabled:text-muted-foreground/40"
                title="Previous version"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="rounded-md border border-border bg-background/70 px-2 py-0.5 font-mono text-[11px] text-foreground/85">
                v{currentIndex + 1}/{totalVersions}
              </span>
              <button
                onClick={handleNext}
                disabled={currentIndex === totalVersions - 1}
                className="rounded-md p-1 text-muted-foreground transition-colors enabled:hover:bg-foreground/10 enabled:hover:text-foreground disabled:cursor-not-allowed disabled:text-muted-foreground/40"
                title="Next version"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          {currentVersion.isOriginal && totalVersions > 1 && (
            <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">Original</span>
          )}

          <button
            onClick={handleCopy}
            title="Copy SQL"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          <div className="ml-1">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleReRun}
                  disabled={isRunning || !editedSql.trim()}
                  className="flex items-center gap-1.5 rounded-md bg-primary/20 px-2.5 py-1 text-xs font-medium text-primary transition-all hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Re-run edited SQL"
                >
                  {isRunning ? (
                    <><div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Running…</>
                  ) : (
                    <><Play className="h-3.5 w-3.5" /> Re-Run</>
                  )}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                  title="Cancel editing"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleEdit}
                className="flex items-center gap-1.5 rounded-md border border-border bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground/85 transition-all hover:bg-foreground/10 hover:text-foreground"
                title="Edit SQL"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SQL Code Display */}
      <div className="relative">
        {isEditing ? (
          <textarea
            value={editedSql}
            onChange={(e) => setEditedSql(e.target.value)}
            className="h-48 w-full resize-y bg-card p-4 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            spellCheck={false}
          />
        ) : (
          <SyntaxHighlighter
            language="sql"
            style={highlighterStyle}
            customStyle={{ margin: 0, padding: '1rem', fontSize: '0.85rem', borderRadius: 0, background: 'transparent' }}
          >
            {currentVersion.sql}
          </SyntaxHighlighter>
        )}
      </div>

      {/* Results Section (if available) */}
      {currentVersion.results && (
        <div className="border-t border-border">
          <div className="flex items-center gap-2 border-b border-border bg-foreground/[0.03] px-4 py-2">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground/85">Results (Version {currentIndex + 1})</span>
            <span className="font-mono text-xs text-muted-foreground/80">{currentVersion.results.length || 0} rows</span>
          </div>
          <div className="max-h-72 overflow-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
                <tr>
                  {Object.keys(currentVersion.results[0] || {}).map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-foreground/85">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentVersion.results.slice(0, 10).map((row: any, idx: number) => (
                  <tr key={idx} className="transition-colors hover:bg-foreground/5">
                    {Object.values(row).map((val: any, colIdx: number) => (
                      <td key={colIdx} className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {val !== null ? String(val) : <span className="italic text-muted-foreground/55">NULL</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {currentVersion.results.length > 10 && (
              <div className="border-t border-border bg-background/60 px-4 py-2 text-center font-mono text-xs text-muted-foreground/80">
                Showing 10 of {currentVersion.results.length} rows
              </div>
            )}
          </div>
        </div>
      )}

      {/* Version History Indicator */}
      {totalVersions > 1 && (
        <div className="border-t border-border bg-background/40 px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
            <div className="flex flex-1 gap-1">
              {versions.map((v, idx) => (
                <button
                  key={v.version}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setIsEditing(false);
                  }}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    idx === currentIndex
                      ? 'bg-primary shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                      : idx < currentIndex
                      ? 'bg-primary/40'
                      : 'bg-foreground/10'
                  }`}
                  title={`Version ${idx + 1}${v.isOriginal ? ' (Original)' : ''}`}
                />
              ))}
            </div>
            <span className="font-mono text-xs">
              {currentVersion.isOriginal ? 'Original' : `Edited ${currentIndex} time${currentIndex > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionedSQLDisplay;
