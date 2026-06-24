/**
 * ResultTable — renders the database result set as a paginated, sortable table.
 * (Logic unchanged; restyled.)
 */
import { useState, useMemo } from 'react';
import { Play, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, Download } from 'lucide-react';
import type { QueryResponse } from '../types/query.types';

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
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-4 backdrop-blur-sm">
        <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        <p className="text-sm text-muted-foreground">Query executed successfully. No rows returned.</p>
      </div>
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

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Play className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Execution Results</span>
          <span className="font-mono text-[10px] text-muted-foreground/55">
            ({executionResult.length} rows{response.response_time_ms ? ` · ${response.response_time_ms}ms` : ''})
          </span>
        </div>
        <button
          onClick={exportCSV}
          title="Export to CSV"
          className="flex items-center gap-1.5 rounded-md border border-border bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </button>
      </div>

      <div className="overflow-x-auto custom-scrollbar rounded-xl border border-border bg-card/60 shadow-lg backdrop-blur-md">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-background/70">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  onClick={() => handleSort(column)}
                  className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-foreground/85 transition-colors hover:bg-foreground/5"
                >
                  <div className="flex items-center gap-1">
                    {column}
                    {getSortIcon(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedData.map((row: Record<string, any>, idx: number) => (
              <tr key={idx} className="group transition-colors hover:bg-foreground/5">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-2.5 font-mono text-xs text-muted-foreground transition-colors group-hover:text-foreground/85">
                    {row[col] !== null && row[col] !== undefined ? (
                      <span className={typeof row[col] === 'number' ? 'text-violet-text font-medium' : 'text-primary/90'}>
                        {String(row[col])}
                      </span>
                    ) : (
                      <span className="italic text-muted-foreground/55">NULL</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
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
              className="rounded-md border border-border bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/85 transition-colors hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-50"
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
                    className={`h-8 w-8 rounded-md font-mono text-xs transition-all ${
                      currentPage === pageNum
                        ? 'border border-primary/30 bg-primary/20 text-primary shadow-[0_0_10px_rgba(16,185,129,0.2)]'
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
              className="rounded-md border border-border bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/85 transition-colors hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-50"
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
