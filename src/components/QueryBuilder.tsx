import { useState, useEffect } from 'react';
import { SlidersHorizontal, X, Plus, Trash2, Play, Sparkles, AlertTriangle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Check, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getVisualizeSchema } from '../api/client';
import { cn } from '@/lib/utils';

interface Column {
  name: string;
  data_type: string;
  primary_key: boolean;
  foreign_key: string | null;
}

interface Table {
  name: string;
  columns: Column[];
}

interface Schema {
  tables: Table[];
}

interface FilterCondition {
  id: string;
  table: string;
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN';
  value: string;
}

interface SelectedColumn {
  table: string;
  column: string;
  aggregation: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'NONE';
}

interface QueryBuilderProps {
  onClose: () => void;
  onRunViaAi: (nlPrompt: string) => void;
  onExecuteDirectSql: (sql: string, nlPrompt: string) => void;
}

const STEPS = [
  { id: 1, label: 'Table' },
  { id: 2, label: 'Joins' },
  { id: 3, label: 'Columns' },
  { id: 4, label: 'Filters' },
  { id: 5, label: 'Sort & Limit' },
];

// BFS to find all tables reachable from a given table via FK relationships
function getReachableTables(schema: Schema, fromTable: string): string[] {
  const graph: Record<string, string[]> = {};
  schema.tables.forEach((t) => { graph[t.name] = []; });
  schema.tables.forEach((t) => {
    t.columns.forEach((c) => {
      if (c.foreign_key) {
        const [targetTable] = c.foreign_key.split('.');
        if (graph[t.name] && graph[targetTable]) {
          if (!graph[t.name].includes(targetTable)) graph[t.name].push(targetTable);
          if (!graph[targetTable].includes(t.name)) graph[targetTable].push(t.name);
        }
      }
    });
  });

  const visited = new Set<string>([fromTable]);
  const queue = [fromTable];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const neighbor of graph[curr] || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  visited.delete(fromTable);
  return Array.from(visited);
}

// BFS to find shortest join path from primaryTable to all required tables
function buildJoinPath(
  schema: Schema,
  primaryTable: string,
  targetTables: Set<string>
): { joins: string[]; tablesVisited: Set<string> } {
  const joins: string[] = [];
  const tablesVisited = new Set<string>([primaryTable]);

  if (targetTables.size === 0) return { joins, tablesVisited };

  const graph: Record<string, Array<{ targetTable: string; localCol: string; targetCol: string }>> = {};
  schema.tables.forEach((t) => { graph[t.name] = []; });
  schema.tables.forEach((t) => {
    t.columns.forEach((c) => {
      if (c.foreign_key) {
        const parts = c.foreign_key.split('.');
        const targetTable = parts[0];
        const targetCol = parts[1];
        if (graph[t.name] && graph[targetTable]) {
          graph[t.name].push({ targetTable, localCol: c.name, targetCol });
          graph[targetTable].push({ targetTable: t.name, localCol: targetCol, targetCol: c.name });
        }
      }
    });
  });

  const activeTargets = Array.from(targetTables).filter((t) => t !== primaryTable);
  const pathTables = new Set<string>([primaryTable]);
  const joinClauses: Record<string, string> = {};

  activeTargets.forEach((target) => {
    const queue: Array<{
      current: string;
      path: Array<{ from: string; to: string; localCol: string; targetCol: string }>;
    }> = [{ current: primaryTable, path: [] }];
    const visited = new Set<string>([primaryTable]);
    let foundPath: typeof queue[0]['path'] | null = null;

    while (queue.length > 0) {
      const { current, path } = queue.shift()!;
      if (current === target) { foundPath = path; break; }
      const neighbors = graph[current] || [];
      for (const edge of neighbors) {
        if (!visited.has(edge.targetTable)) {
          visited.add(edge.targetTable);
          queue.push({ current: edge.targetTable, path: [...path, { from: current, to: edge.targetTable, localCol: edge.localCol, targetCol: edge.targetCol }] });
        }
      }
    }

    if (foundPath) {
      foundPath.forEach((edge) => {
        pathTables.add(edge.to);
        joinClauses[edge.to] = `JOIN ${edge.to} ON ${edge.from}.${edge.localCol} = ${edge.to}.${edge.targetCol}`;
      });
    }
  });

  const joinClausesList: string[] = [];
  const bfsQueue = [primaryTable];
  const bfsVisited = new Set<string>([primaryTable]);
  const orderedTables: string[] = [];

  while (bfsQueue.length > 0) {
    const curr = bfsQueue.shift()!;
    orderedTables.push(curr);
    for (const edge of graph[curr] || []) {
      if (pathTables.has(edge.targetTable) && !bfsVisited.has(edge.targetTable)) {
        bfsVisited.add(edge.targetTable);
        bfsQueue.push(edge.targetTable);
      }
    }
  }

  orderedTables.forEach((tbl) => {
    if (tbl !== primaryTable && joinClauses[tbl]) {
      joinClausesList.push(joinClauses[tbl]);
      tablesVisited.add(tbl);
    }
  });

  return { joins: joinClausesList, tablesVisited };
}

export default function QueryBuilder({ onClose, onRunViaAi, onExecuteDirectSql }: QueryBuilderProps) {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wizard step
  const [currentStep, setCurrentStep] = useState(1);

  // Builder states
  const [primaryTable, setPrimaryTable] = useState<string>('');
  const [joinedTables, setJoinedTables] = useState<Set<string>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<SelectedColumn[]>([]);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [orderBy, setOrderBy] = useState<{ table: string; column: string; direction: 'ASC' | 'DESC' } | null>(null);
  const [limit, setLimit] = useState<number>(50);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [joinSearch, setJoinSearch] = useState('');

  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const data = await getVisualizeSchema();
        setSchema(data);
        if (data.tables && data.tables.length > 0) {
          setPrimaryTable(data.tables[0].name);
        }
      } catch (err) {
        setError('Failed to fetch schema metadata for Query Builder.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSchema();
  }, []);

  // Reset all downstream state when primary table changes
  const handlePrimaryTableChange = (tableName: string) => {
    setPrimaryTable(tableName);
    setJoinedTables(new Set());
    setSelectedColumns([]);
    setFilters([]);
    setOrderBy(null);
    setCurrentStep(1);
  };

  const toggleJoinedTable = (tableName: string) => {
    setJoinedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
        setSelectedColumns((sc) => sc.filter((c) => c.table !== tableName));
        setFilters((f) => f.filter((fi) => fi.table !== tableName));
        if (orderBy?.table === tableName) setOrderBy(null);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  const toggleColumnSelection = (table: string, column: string) => {
    setSelectedColumns((prev) => {
      const exists = prev.find((c) => c.table === table && c.column === column);
      if (exists) return prev.filter((c) => !(c.table === table && c.column === column));
      return [...prev, { table, column, aggregation: 'NONE' }];
    });
  };

  const updateColumnAggregation = (table: string, column: string, agg: SelectedColumn['aggregation']) => {
    setSelectedColumns((prev) =>
      prev.map((c) => (c.table === table && c.column === column ? { ...c, aggregation: agg } : c))
    );
  };

  const addFilter = () => {
    if (!schema) return;
    const tableObj = schema.tables.find((t) => t.name === primaryTable);
    const defaultColumn = tableObj?.columns[0]?.name || '';
    setFilters((prev) => [
      ...prev,
      { id: Date.now().toString(), table: primaryTable, column: defaultColumn, operator: '=', value: '' },
    ]);
  };

  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeFilter = (id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  // Active tables = primary + explicitly joined
  const activeTables = new Set<string>([primaryTable, ...Array.from(joinedTables)]);

  // Columns available for filters / sort (from all active tables)
  const activeColumns: Array<{ table: string; column: string }> = [];
  if (schema) {
    schema.tables.forEach((t) => {
      if (activeTables.has(t.name)) {
        t.columns.forEach((c) => activeColumns.push({ table: t.name, column: c.name }));
      }
    });
  }

  // SQL + NL generation
  const generateOutput = () => {
    if (!primaryTable || !schema) return { sql: '', nl: '' };

    const requiredTables = new Set<string>(joinedTables);
    selectedColumns.forEach((c) => requiredTables.add(c.table));
    filters.forEach((f) => requiredTables.add(f.table));
    if (orderBy) requiredTables.add(orderBy.table);

    const { joins, tablesVisited } = buildJoinPath(schema, primaryTable, requiredTables);

    let selectClause = '';
    if (selectedColumns.length === 0) {
      selectClause = `${primaryTable}.*`;
    } else {
      selectClause = selectedColumns
        .map((c) =>
          c.aggregation && c.aggregation !== 'NONE'
            ? `${c.aggregation}(${c.table}.${c.column}) AS ${c.aggregation.toLowerCase()}_of_${c.column}`
            : `${c.table}.${c.column}`
        )
        .join(', ');
    }

    let sql = `SELECT ${selectClause}\nFROM ${primaryTable}`;
    if (joins.length > 0) sql += '\n' + joins.join('\n');

    const whereConditions = filters
      .filter((f) => f.column && f.value.trim() !== '')
      .map((f) => {
        let valStr = f.value;
        if (f.operator === 'LIKE') valStr = `'%${valStr}%'`;
        else if (f.operator === 'IN') valStr = `(${valStr})`;
        else if (isNaN(Number(valStr))) valStr = `'${valStr}'`;
        return `${f.table}.${f.column} ${f.operator} ${valStr}`;
      });

    if (whereConditions.length > 0) sql += `\nWHERE ${whereConditions.join(' AND ')}`;

    const hasAggregations = selectedColumns.some((c) => c.aggregation && c.aggregation !== 'NONE');
    if (hasAggregations && selectedColumns.length > 0) {
      const nonAggColumns = selectedColumns.filter((c) => !c.aggregation || c.aggregation === 'NONE');
      if (nonAggColumns.length > 0) {
        sql += `\nGROUP BY ${nonAggColumns.map((c) => `${c.table}.${c.column}`).join(', ')}`;
      }
    }

    if (orderBy && orderBy.column) sql += `\nORDER BY ${orderBy.table}.${orderBy.column} ${orderBy.direction}`;
    if (limit) sql += `\nLIMIT ${limit}`;
    sql += ';';

    let nlCols = selectedColumns.length === 0
      ? 'all columns'
      : selectedColumns.map((c) =>
          c.aggregation && c.aggregation !== 'NONE' ? `${c.aggregation.toLowerCase()} of ${c.column}` : c.column
        ).join(', ');

    let nl = `Show me ${nlCols} from the ${primaryTable} table`;
    const tablesList = Array.from(tablesVisited).filter((t) => t !== primaryTable);
    if (tablesList.length > 0) nl += ` (including fields from ${tablesList.join(' and ')})`;

    if (whereConditions.length > 0) {
      const nlFilters = filters
        .filter((f) => f.column && f.value.trim() !== '')
        .map((f) => {
          const opLabel = f.operator === 'LIKE' ? 'contains' : f.operator === '=' ? 'is' : f.operator;
          return `${f.column} ${opLabel} "${f.value}"`;
        });
      nl += ` where ${nlFilters.join(' and ')}`;
    }
    if (orderBy) nl += ` sorted by ${orderBy.column} (${orderBy.direction.toLowerCase() === 'asc' ? 'ascending' : 'descending'})`;
    if (limit) nl += ` limit to ${limit} records`;

    return { sql, nl };
  };

  const { sql, nl } = generateOutput();

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col gap-4 rounded-2xl glass-panel p-6">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground/50" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !schema) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl glass-panel p-8 text-destructive-text">
        <AlertTriangle className="h-8 w-8" />
        <p className="text-sm font-semibold">{error || 'Failed to load schema'}</p>
        <Button onClick={onClose} variant="outline" size="sm">Close Panel</Button>
      </div>
    );
  }

  const reachableTables = getReachableTables(schema, primaryTable);
  const canRunQuery = !!primaryTable && selectedColumns.length > 0;

  return (
    <div className="@container flex h-full w-full flex-col rounded-2xl glass-panel overflow-hidden animate-slide-up">
      {/* Drawer Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-foreground/[0.02] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="h-4 w-4 text-info-text" />
          <h3 className="font-display text-base font-bold tracking-tight text-foreground">Visual Query Builder</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground transition-colors"
          title="Close Builder"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Step Indicator */}
      <div className="shrink-0 border-b border-border bg-foreground/[0.015] px-5 py-3">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors',
                  currentStep === step.id
                    ? 'text-primary'
                    : step.id < currentStep
                    ? 'text-muted-foreground hover:text-foreground cursor-pointer'
                    : 'text-muted-foreground/40 cursor-default pointer-events-none'
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
                    currentStep === step.id
                      ? 'bg-primary text-primary-foreground'
                      : step.id < currentStep
                      ? 'bg-primary/20 text-primary'
                      : 'bg-foreground/[0.06] text-muted-foreground/50'
                  )}
                >
                  {step.id < currentStep ? <Check className="h-2.5 w-2.5" /> : step.id}
                </span>
                <span className="hidden @[480px]:inline font-mono text-[9px] font-bold uppercase tracking-wider">
                  {step.label}
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className={cn('mx-1 h-px w-4 @[480px]:w-6', step.id < currentStep ? 'bg-primary/30' : 'bg-border')} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5">

        {/* ── Step 1: Primary Table ── */}
        {currentStep === 1 && (
          <div className="space-y-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-1">
                Select Primary Table
              </p>
              <p className="text-xs text-muted-foreground/60 mb-3">
                Choose the main table your query will start from. Changing this resets all other selections.
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
              <input
                type="text"
                aria-label="Search tables"
                placeholder="Search tables…"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-background/50 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
            </div>
            {(() => {
              const filtered = schema.tables.filter((t) => t.name.toLowerCase().includes(tableSearch.toLowerCase()));
              return filtered.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-background/10 py-5 text-center text-xs text-muted-foreground/60">
                  No tables match "<span className="font-semibold">{tableSearch}</span>"
                </p>
              ) : (
                <div className="grid gap-2">
                  {filtered.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => handlePrimaryTableChange(t.name)}
                      className={cn(
                        'flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all',
                        primaryTable === t.name
                          ? 'border-primary/40 bg-primary/[0.06] text-foreground'
                          : 'border-border bg-background/40 text-foreground/70 hover:bg-foreground/[0.02] hover:text-foreground'
                      )}
                    >
                      <span className="text-sm font-semibold break-all leading-snug">{t.name}</span>
                      <div className="flex shrink-0 items-center gap-2 ml-3">
                        <span className="font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">
                          {t.columns.length} col{t.columns.length !== 1 ? 's' : ''}
                        </span>
                        {primaryTable === t.name && (
                          <Badge className="bg-primary/10 border-primary/20 text-primary text-[8px] font-mono px-1 whitespace-nowrap">Selected</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Step 2: Connected Tables (Joins) ── */}
        {currentStep === 2 && (
          <div className="space-y-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-1">
                Select Connected Tables
              </p>
              <p className="text-xs text-muted-foreground/60 mb-3">
                Check the tables you want to join with <span className="font-semibold text-foreground/70">{primaryTable}</span>. Only tables with a direct or indirect foreign-key relationship are shown.
              </p>
            </div>
            {reachableTables.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-background/10 py-6 text-center text-xs text-muted-foreground/60">
                No tables have a foreign-key relationship with <span className="font-semibold">{primaryTable}</span>.
              </p>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
                  <input
                    type="text"
                    aria-label="Search joinable tables"
                    placeholder="Search joinable tables…"
                    value={joinSearch}
                    onChange={(e) => setJoinSearch(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background/50 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  />
                </div>
                {(() => {
                  const filtered = reachableTables.filter((n) => n.toLowerCase().includes(joinSearch.toLowerCase()));
                  return filtered.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border bg-background/10 py-5 text-center text-xs text-muted-foreground/60">
                      No tables match "<span className="font-semibold">{joinSearch}</span>"
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {filtered.map((tableName) => {
                        const tableObj = schema.tables.find((t) => t.name === tableName);
                        const isJoined = joinedTables.has(tableName);
                        return (
                          <button
                            key={tableName}
                            onClick={() => toggleJoinedTable(tableName)}
                            className={cn(
                              'flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all',
                              isJoined
                                ? 'border-primary/40 bg-primary/[0.06] text-foreground'
                                : 'border-border bg-background/40 text-foreground/70 hover:bg-foreground/[0.02] hover:text-foreground'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                                isJoined ? 'border-primary bg-primary' : 'border-border bg-background'
                              )}>
                                {isJoined && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                              </div>
                              <span className="text-sm font-semibold break-all leading-snug">{tableName}</span>
                            </div>
                            <span className="font-mono text-[9px] text-muted-foreground/60 shrink-0 ml-3 whitespace-nowrap">
                              {tableObj?.columns.length ?? 0} cols
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
            {joinedTables.size > 0 && (
              <p className="text-[10px] text-muted-foreground/60 pt-1">
                {joinedTables.size} table{joinedTables.size !== 1 ? 's' : ''} will be joined to <span className="font-semibold text-foreground/70">{primaryTable}</span>.
              </p>
            )}
          </div>
        )}

        {/* ── Step 3: Select Columns ── */}
        {currentStep === 3 && (
          <div className="space-y-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-1">
                Choose Columns &amp; Aggregations
              </p>
              <p className="text-xs text-muted-foreground/60 mb-3">
                Select which columns to include. Optionally apply an aggregation function to any column.
              </p>
            </div>
            <div className="space-y-5">
              {Array.from(activeTables).map((tableName) => {
                const tableObj = schema.tables.find((t) => t.name === tableName);
                if (!tableObj) return null;
                const isPrimary = tableName === primaryTable;
                return (
                  <div key={tableName} className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display text-xs font-bold text-foreground">{tableName}</span>
                      {isPrimary && (
                        <Badge className="bg-primary/10 border-primary/20 text-primary text-[8px] font-mono px-1">Primary</Badge>
                      )}
                    </div>
                    <div className="grid gap-2 @[480px]:grid-cols-2">
                      {tableObj.columns.map((col) => {
                        const isSelected = !!selectedColumns.find((c) => c.table === tableName && c.column === col.name);
                        const currentSelection = selectedColumns.find((c) => c.table === tableName && c.column === col.name);
                        return (
                          <div
                            key={col.name}
                            className={cn(
                              'flex flex-col gap-2 rounded-lg border p-2.5 transition-colors',
                              isSelected
                                ? 'border-primary/25 bg-primary/[0.02]'
                                : 'border-border bg-background/40 hover:bg-foreground/[0.02]'
                            )}
                          >
                            <label className="flex cursor-pointer items-start gap-2 text-xs font-medium text-foreground">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleColumnSelection(tableName, col.name)}
                                className="accent-primary mt-px shrink-0"
                              />
                              <span className="break-all leading-snug">{col.name}</span>
                            </label>
                            {isSelected && (
                              <select
                                aria-label="Aggregation Function"
                                value={currentSelection?.aggregation || 'NONE'}
                                onChange={(e) => updateColumnAggregation(tableName, col.name, e.target.value as SelectedColumn['aggregation'])}
                                className="rounded border border-border/50 bg-background/80 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground focus:outline-none"
                              >
                                <option value="NONE">No aggregation</option>
                                <option value="COUNT">COUNT</option>
                                <option value="SUM">SUM</option>
                                <option value="AVG">AVG</option>
                                <option value="MIN">MIN</option>
                                <option value="MAX">MAX</option>
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 4: Filters (WHERE) ── */}
        {currentStep === 4 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-1">
                  Filter Rows (WHERE)
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Add AND conditions to narrow your results.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFilter}
                className="h-7 gap-1 px-2 text-[10px] font-bold uppercase tracking-wider shrink-0"
              >
                <Plus className="h-3 w-3" /> Add Filter
              </Button>
            </div>

            {filters.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-background/10 py-6 text-center text-xs text-muted-foreground/60">
                No filters added. Returning all rows.
              </p>
            ) : (
              <div className="space-y-3">
                {filters.map((filter) => (
                  <div
                    key={filter.id}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-background/25 p-3 @[480px]:flex-row @[480px]:items-center"
                  >
                    <select
                      aria-label="Filter Column"
                      value={`${filter.table}.${filter.column}`}
                      onChange={(e) => {
                        const [t, c] = e.target.value.split('.');
                        updateFilter(filter.id, { table: t, column: c });
                      }}
                      className="flex-1 rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
                    >
                      {activeColumns.map((col) => (
                        <option key={`${col.table}.${col.column}`} value={`${col.table}.${col.column}`}>
                          {col.table}.{col.column}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Filter Operator"
                      value={filter.operator}
                      onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterCondition['operator'] })}
                      className="rounded-lg border border-border bg-background/50 px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
                    >
                      <option value="=">=</option>
                      <option value="!=">!=</option>
                      <option value=">">&gt;</option>
                      <option value="<">&lt;</option>
                      <option value=">=">&gt;=</option>
                      <option value="<=">&lt;=</option>
                      <option value="LIKE">contains</option>
                      <option value="IN">in list</option>
                    </select>

                    <input
                      type="text"
                      aria-label="Filter value"
                      placeholder="value"
                      value={filter.value}
                      onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                      className="flex-1 rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />

                    <button
                      type="button"
                      onClick={() => removeFilter(filter.id)}
                      className="rounded p-1 text-destructive-text/80 hover:bg-destructive-bg hover:text-destructive-text transition-colors self-end @[480px]:self-center"
                      title="Remove filter"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Sort & Limit ── */}
        {currentStep === 5 && (
          <div className="space-y-5">
            {/* Sort Order */}
            <div className="space-y-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                Sort Order (ORDER BY)
              </p>
              <div className="flex gap-2">
                <select
                  aria-label="Sort Column"
                  value={orderBy ? `${orderBy.table}.${orderBy.column}` : 'NONE'}
                  onChange={(e) => {
                    if (e.target.value === 'NONE') {
                      setOrderBy(null);
                    } else {
                      const [t, c] = e.target.value.split('.');
                      setOrderBy({ table: t, column: c, direction: orderBy?.direction || 'ASC' });
                    }
                  }}
                  className="flex-1 rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                >
                  <option value="NONE">No sort</option>
                  {activeColumns.map((col) => (
                    <option key={`${col.table}.${col.column}`} value={`${col.table}.${col.column}`}>
                      {col.table}.{col.column}
                    </option>
                  ))}
                </select>

                {orderBy && (
                  <button
                    type="button"
                    onClick={() =>
                      setOrderBy((prev) =>
                        prev ? { ...prev, direction: prev.direction === 'ASC' ? 'DESC' : 'ASC' } : null
                      )
                    }
                    className="rounded-lg border border-border bg-background/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.02]"
                  >
                    {orderBy.direction}
                  </button>
                )}
              </div>
            </div>

            {/* Limit */}
            <div className="space-y-2">
              <label htmlFor="builder-limit-input" className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                Row Limit
              </label>
              <input
                id="builder-limit-input"
                type="number"
                min={1}
                max={1000}
                value={limit || ''}
                onChange={(e) => setLimit(e.target.value ? parseInt(e.target.value, 10) : 0)}
                className="w-full rounded-lg border border-border bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none"
              />
            </div>

            {/* Run buttons (prominent on final step) */}
            <div className="pt-2 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={!canRunQuery}
                onClick={() => onRunViaAi(nl)}
                className="gap-2 h-10 border-primary/30 text-primary hover:bg-primary/10 transition-all font-semibold text-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Run via AI
              </Button>
              <Button
                type="button"
                disabled={!canRunQuery}
                onClick={() => onExecuteDirectSql(sql, nl)}
                className="gap-2 h-10 bg-secondary hover:bg-accent text-secondary-foreground border border-border transition-all font-semibold text-xs"
              >
                <Play className="h-3.5 w-3.5" />
                Execute Direct SQL
              </Button>
            </div>
            {!canRunQuery && (
              <p className="text-center text-[10px] text-muted-foreground/50">
                Select at least one column (Step 3) to enable query execution.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Shared Footer — always visible */}
      <div className="shrink-0 border-t border-border bg-foreground/[0.01]">
        {/* Navigation row */}
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
            className="h-7 gap-1 px-3 text-[10px] font-bold uppercase tracking-wider"
          >
            <ChevronLeft className="h-3 w-3" /> Back
          </Button>

          <span className="font-mono text-[9px] text-muted-foreground/50">
            Step {currentStep} of {STEPS.length}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentStep === STEPS.length}
            onClick={() => setCurrentStep((s) => Math.min(STEPS.length, s + 1))}
            className="h-7 gap-1 px-3 text-[10px] font-bold uppercase tracking-wider"
          >
            Next <ChevronRight className="h-3 w-3" />
          </Button>
        </div>

        {/* Collapsible preview toggle */}
        <button
          type="button"
          onClick={() => setPreviewOpen((o) => !o)}
          className="flex w-full items-center justify-between border-t border-border/60 bg-foreground/[0.015] px-4 py-2 text-left transition-colors hover:bg-foreground/[0.03]"
        >
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Preview SQL
          </span>
          {previewOpen
            ? <ChevronUp className="h-3 w-3 text-muted-foreground/50" />
            : <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
          }
        </button>

        {/* Expandable preview pane */}
        {previewOpen && (
          <div className="space-y-2.5 px-4 pb-4 pt-2">
            <div className="space-y-1">
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Question (AI Prompt)
              </span>
              <p className="rounded-lg border border-border/40 bg-background/30 px-3 py-2 text-xs text-foreground/85 select-all leading-relaxed max-h-14 overflow-y-auto custom-scrollbar">
                {nl || 'Select a table and columns to build a query...'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                SQL Statement
              </span>
              <pre className="rounded-lg border border-border/40 bg-background/30 px-3 py-2 text-[10px] text-info-text font-mono select-all overflow-x-auto custom-scrollbar leading-normal max-h-24">
                {sql || '-- Select a table and columns to build a query'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
