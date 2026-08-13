/**
 * ResultTable — renders the database result set as a paginated, sortable table.
 * (Logic unchanged; restyled.)
 */
import { useState, useMemo, useRef } from 'react';
import { Play, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, Download, Check, Inbox } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import type { QueryResponse } from '../types/query.types';

// Above this many rows on a single page we virtualize the tbody so the DOM node
// count stays constant regardless of result size (dependency-free windowing).
const VIRTUALIZE_THRESHOLD = 100;
const ROW_HEIGHT = 37; // px — must match the rendered <td> line-height + padding
const VIRTUAL_VIEWPORT = 560; // px — max scroll-area height when virtualizing
const OVERSCAN = 8;

interface ResultTableProps {
  response: QueryResponse;
  editedResult?: {
    results?: Record<string, unknown>[];
    error?: string;
  };
}

type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  column: string;
  direction: SortDirection;
}

const ResultTable = ({ response, editedResult }: ResultTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [scrollTop, setScrollTop] = useState(0);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayResult = editedResult?.results || response.execution_result;
  const displayError = editedResult?.error || response.execution_error;

  // Execution Error
  if (displayError) {
    return (
      <div className="mb-4 rounded-xl border border-destructive-border bg-destructive-bg p-3 backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive-text" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-destructive-text">Execution Error</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-all rounded-lg border border-destructive-border/30 bg-destructive-bg/5 p-3 font-mono text-xs text-destructive-text/90 shadow-inner">
          {displayError}
        </p>
      </div>
    );
  }

  if (!displayResult) return null;

  // Empty results
  if (displayResult.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No rows returned"
        description="Query executed successfully, but no matching rows were found."
        compact
        className="mb-4"
      />
    );
  }

  const executionResult = displayResult;

  const sortedData = useMemo(() => {
    if (!sortConfig || !sortConfig.direction) {
      return executionResult;
    }
    return [...executionResult].sort((a, b) => {
      const aVal = a[sortConfig.column];
      const bVal = b[sortConfig.column];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [executionResult, sortConfig]);

  // A column is numeric when every non-null value in it is a number. Numeric
  // columns are right-aligned (header + cells) so digits line up (item 17).
  const numericColumns = useMemo(() => {
    const nums = new Set<string>();
    const cols = Object.keys(executionResult[0] ?? {});
    for (const col of cols) {
      let sawValue = false;
      let allNumeric = true;
      for (const row of executionResult) {
        const v = row[col];
        if (v === null || v === undefined) continue;
        sawValue = true;
        if (typeof v !== 'number') { allNumeric = false; break; }
      }
      if (sawValue && allNumeric) nums.add(col);
    }
    return nums;
  }, [executionResult]);

  if (!sortedData || sortedData.length === 0) {
    return null;
  }

  const effectiveRPP = rowsPerPage === 0 ? sortedData.length : rowsPerPage;
  const totalPages = Math.ceil(sortedData.length / effectiveRPP);
  const startIndex = (currentPage - 1) * effectiveRPP;
  const endIndex = startIndex + effectiveRPP;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  const handleRowsPerPageChange = (val: string) => {
    setRowsPerPage(val === 'all' ? 0 : Number(val));
    setCurrentPage(1);
  };

  const exportCSV = () => {
    const cols = Object.keys(sortedData[0]);
    const escape = (v: unknown) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(','), ...sortedData.map((row) => cols.map((c) => escape(row[c])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Excel export without a dependency: Excel opens an HTML <table> saved with a
  // .xls extension and the ms-excel MIME type, preserving columns/rows.
  const exportExcel = () => {
    const cols = Object.keys(sortedData[0]);
    const escapeHtml = (v: unknown) => {
      if (v === null || v === undefined) return '';
      return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    };
    const header = `<tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
    const body = sortedData
      .map((row) => `<tr>${cols.map((c) => `<td>${escapeHtml(row[c])}</td>`).join('')}</tr>`)
      .join('');
    const html =
      `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">` +
      `<head><meta charset="utf-8"></head><body><table border="1">${header}${body}</table></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'results.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (column: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.column === column) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null;
      }
    }
    setSortConfig(direction ? { column, direction } : null);
  };

  const getSortIcon = (column: string) => {
    if (!sortConfig || sortConfig.column !== column) {
      return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/55" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ChevronUp className="h-3.5 w-3.5 text-primary" />;
    }
    return <ChevronDown className="h-3.5 w-3.5 text-primary" />;
  };

  const columns = Object.keys(executionResult[0]);

  // ── Virtualization: only window when a single page holds many rows ──────────
  const virtualize = paginatedData.length > VIRTUALIZE_THRESHOLD;
  const visibleCount = Math.ceil(VIRTUAL_VIEWPORT / ROW_HEIGHT);
  const startRow = virtualize ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN) : 0;
  const endRow = virtualize
    ? Math.min(paginatedData.length, startRow + visibleCount + OVERSCAN * 2)
    : paginatedData.length;
  const rowsToRender = paginatedData.slice(startRow, endRow);
  const topPad = startRow * ROW_HEIGHT;
  const bottomPad = (paginatedData.length - endRow) * ROW_HEIGHT;

  // Copy a cell's raw underlying value (not the formatted display) to the
  // clipboard, with ~1s of transient feedback keyed by "rowIndex:col" (item 17).
  const handleCopyCell = (row: Record<string, any>, col: string, cellKey: string) => {
    const raw = row[col];
    const text = raw === null || raw === undefined ? '' : String(raw);
    navigator.clipboard?.writeText(text);
    setCopiedCell(cellKey);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopiedCell(null), 1000);
  };

  const renderCell = (row: Record<string, any>, col: string, rowKey: number) => {
    const cellKey = `${rowKey}:${col}`;
    const isCopied = copiedCell === cellKey;
    const isNull = row[col] === null || row[col] === undefined;
    return (
      <td
        key={col}
        onClick={() => handleCopyCell(row, col, cellKey)}
        title="Click to copy"
        className={`relative cursor-pointer px-4 py-2.5 font-mono text-xs text-muted-foreground transition-colors group-hover:text-foreground/85 ${
          numericColumns.has(col) ? 'text-right' : ''
        } ${isCopied ? 'bg-primary/15 ring-1 ring-inset ring-primary/40' : ''}`}
      >
        {!isNull ? (
          <span className={typeof row[col] === 'number' ? 'text-violet-text font-medium tabular-nums' : 'text-primary/90'}>
            {typeof row[col] === 'number' ? row[col].toLocaleString() : String(row[col])}
          </span>
        ) : (
          <span className="italic text-muted-foreground/55">NULL</span>
        )}
        {isCopied && !isNull && (
          <span className="pointer-events-none absolute right-1.5 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 rounded-md border border-primary/30 bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary shadow-sm">
            <Check className="h-2.5 w-2.5" />
            Copied
          </span>
        )}
      </td>
    );
  };

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Play className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Execution Results</span>
          <span className="font-mono text-[10px] text-muted-foreground/55">
            ({executionResult.length} rows{response.response_time_ms ? ` · ${response.response_time_ms}ms` : ''})
          </span>
          {virtualize && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary" title="Rows are virtualized for smooth scrolling">
              virtualized
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={exportCSV}
            title="Export to CSV"
            className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            onClick={exportExcel}
            title="Export to Excel"
            className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            Excel
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={virtualize ? (e) => setScrollTop((e.target as HTMLDivElement).scrollTop) : undefined}
        className="overflow-auto custom-scrollbar rounded-xl border border-border bg-card/60 shadow-lg backdrop-blur-md"
        style={virtualize ? { maxHeight: VIRTUAL_VIEWPORT } : undefined}
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  onClick={() => handleSort(column)}
                  className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 text-xs font-semibold text-foreground/85 transition-colors hover:bg-foreground/5 ${
                    numericColumns.has(column) ? 'text-right' : 'text-left'
                  }`}
                >
                  <div className={`flex items-center gap-1 ${numericColumns.has(column) ? 'justify-end' : ''}`}>
                    {column}
                    {getSortIcon(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {topPad > 0 && <tr style={{ height: topPad }} aria-hidden="true"><td colSpan={columns.length} className="p-0" /></tr>}
            {rowsToRender.map((row: Record<string, any>, idx: number) => (
              <tr key={startRow + idx} className="group transition-colors hover:bg-foreground/5" style={virtualize ? { height: ROW_HEIGHT } : undefined}>
                {columns.map((col) => renderCell(row, col, startRow + idx))}
              </tr>
            ))}
            {bottomPad > 0 && <tr style={{ height: bottomPad }} aria-hidden="true"><td colSpan={columns.length} className="p-0" /></tr>}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground/80">
            {rowsPerPage === 0
              ? `Showing all ${sortedData.length} rows`
              : `Showing ${startIndex + 1}–${Math.min(endIndex, sortedData.length)} of ${sortedData.length} rows`}
          </span>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1">
            <span className="font-mono text-[10px] text-muted-foreground/70">Rows</span>
            <select
              aria-label="Rows per page"
              value={rowsPerPage === 0 ? 'all' : String(rowsPerPage)}
              onChange={(e) => handleRowsPerPageChange(e.target.value)}
              className="cursor-pointer bg-transparent font-mono text-xs text-foreground focus:outline-none [&>option]:bg-popover"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="min-h-[44px] rounded-md border border-border bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/85 transition-colors hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <div className="mx-1 flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-[44px] w-[44px] rounded-md font-mono text-xs transition-all ${
                      currentPage === pageNum
                        ? 'border border-primary/30 bg-primary/20 text-primary shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_20%,transparent)]'
                        : 'bg-transparent text-muted-foreground hover:bg-foreground/5'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="min-h-[44px] rounded-md border border-border bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/85 transition-colors hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultTable;
