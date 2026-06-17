import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getVisualizeSchema, getDatabaseConfig, handleApiError } from '../api/client';
import { Loader2, RefreshCw, AlertTriangle, Maximize2, X } from 'lucide-react';

// ── localStorage cache helpers ────────────────────────────────────────────────
const CACHE_KEY = 'nl2sql_schema_graph_cache';

interface SchemaCache {
  dbUrl: string;
  schema: any;
}

function saveSchemaCache(dbUrl: string, schema: any) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ dbUrl, schema }));
  } catch {
    // quota exceeded or private mode — ignore silently
  }
}

function loadSchemaCache(): SchemaCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Custom Table Node Component ───────────────────────────────────────────────
const TableNode = ({ data, selected }: { data: any; selected: boolean }) => {
  const isHighlighted = data.isHighlighted;

  return (
    <div
      className={`w-64 overflow-hidden rounded-xl border font-sans text-sm backdrop-blur-xl transition-all ${
        selected
          ? 'border-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.4)]'
          : isHighlighted
          ? 'border-primary shadow-[0_0_20px_rgba(16,185,129,0.4)] ring-2 ring-primary/50'
          : 'border-border shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
      } bg-popover/95`}
    >
      <Handle type="target" position={Position.Left} className="h-4 w-2 rounded-sm border-none bg-violet-500" />

      <div
        className={`flex items-center justify-between border-b px-4 py-2 ${
          isHighlighted ? 'border-primary/30 bg-primary/20' : 'border-border bg-foreground/[0.04]'
        }`}
      >
        <span className="font-display font-bold tracking-wide text-foreground">{data.label}</span>
      </div>

      <div className="max-h-48 space-y-1 overflow-y-auto custom-scrollbar p-2">
        {data.columns.map((col: any) => (
          <div key={col.name} className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-foreground/5">
            <div className="flex items-center gap-1.5">
              <span className={col.primary_key ? 'font-bold text-warning-text' : 'text-foreground/85'}>{col.name}</span>
              {col.primary_key && <span className="text-[10px] text-warning-text/80">(PK)</span>}
              {col.foreign_key && <span className="text-[10px] text-violet-text/80">(FK)</span>}
            </div>
            <span className="font-mono text-[10px] text-muted-foreground/80">{col.data_type.split('(')[0]}</span>
          </div>
        ))}
      </div>

      <Handle type="source" position={Position.Right} className="h-4 w-2 rounded-sm border-none bg-primary" />
    </div>
  );
};

const nodeTypes = {
  tableNode: TableNode,
};

interface SchemaGraphProps {
  highlightedTables?: string[];
}

// ── Helper: build ReactFlow nodes & edges from a schema response ──────────────
function buildNodesAndEdges(schema: any, highlightedTables: string[]) {
  const newNodes: Node[] = [];
  const newEdges: Edge[] = [];

  const cols = 3;
  const spacingX = 350;
  const spacingY = 300;

  schema.tables.forEach((table: any, idx: number) => {
    const x = (idx % cols) * spacingX + 50;
    const y = Math.floor(idx / cols) * spacingY + 50;

    newNodes.push({
      id: table.name,
      type: 'tableNode',
      position: { x, y },
      data: {
        label: table.name,
        columns: table.columns,
        isHighlighted: highlightedTables.includes(table.name),
      },
    });

    table.columns.forEach((col: any) => {
      if (col.foreign_key) {
        const targetTable = col.foreign_key.split('.')[0];
        newEdges.push({
          id: `e-${table.name}-${targetTable}-${col.name}`,
          source: table.name,
          target: targetTable,
          label: col.name,
          animated: highlightedTables.includes(table.name) || highlightedTables.includes(targetTable),
          style: {
            stroke: highlightedTables.includes(table.name) ? '#10b981' : '#8b5cf6',
            strokeWidth: 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: highlightedTables.includes(table.name) ? '#10b981' : '#8b5cf6',
          },
        });
      }
    });
  });

  return { newNodes, newEdges };
}

export default function SchemaGraph({ highlightedTables = [] }: SchemaGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staleWarning, setStaleWarning] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track current DB URL so we can compare against cache
  const currentDbUrl = useRef<string | null>(null);

  // Close fullscreen on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    if (isFullscreen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const fetchSchema = useCallback(async (retryCount = 0) => {
    setLoading(true);
    setError(null);
    setStaleWarning(null);

    // Fetch current DB URL for cache comparison
    let dbUrl = '';
    try {
      const dbConfig = await getDatabaseConfig();
      dbUrl = dbConfig.database_url || '';
      currentDbUrl.current = dbUrl;
    } catch {
      // If we can't get DB config, proceed without caching logic
    }

    try {
      const schema = await getVisualizeSchema();
      if (!schema || !schema.tables) {
        throw new Error('Invalid schema format received.');
      }

      // Save successful response to cache
      if (dbUrl) {
        saveSchemaCache(dbUrl, schema);
      }

      const { newNodes, newEdges } = buildNodesAndEdges(schema, highlightedTables);
      setNodes(newNodes);
      setEdges(newEdges);
    } catch (err: any) {
      console.error(err);

      // Auto-retry once on timeout (first request often warms up a cold DB pool)
      const isTimeout =
        err?.code === 'ECONNABORTED' ||
        err?.message?.toLowerCase().includes('timeout');
      if (isTimeout && retryCount < 1) {
        console.log('Schema graph timed out, retrying…');
        return fetchSchema(retryCount + 1);
      }

      // ── Try to restore from cache ──────────────────────────────────────────
      const cache = loadSchemaCache();
      if (cache?.schema?.tables && dbUrl && cache.dbUrl === dbUrl) {
        // Same DB → show the cached graph with a stale-data warning
        const { newNodes, newEdges } = buildNodesAndEdges(cache.schema, highlightedTables);
        setNodes(newNodes);
        setEdges(newEdges);
        setStaleWarning('Unable to load the latest schema — showing previously loaded data.');
        setError(null);
      } else {
        // Different DB or no cache — show retry error
        const msg = isTimeout
          ? 'Database is taking too long to respond. Please check your connection and try again.'
          : handleApiError(err) || 'Failed to load schema.';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [highlightedTables, setNodes, setEdges]);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  // Update highlighted state without full refetch if nodes exist
  useEffect(() => {
    if (nodes.length > 0) {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            isHighlighted: highlightedTables.includes(node.id),
          },
        })),
      );

      setEdges((eds) =>
        eds.map((edge): Edge => {
          const isHighlight = highlightedTables.includes(edge.source) || highlightedTables.includes(edge.target);
          return {
            ...edge,
            animated: isHighlight,
            style: {
              ...edge.style,
              stroke: isHighlight ? '#10b981' : '#7c3aed',
            },
            markerEnd: {
              ...(edge.markerEnd as Record<string, unknown>),
              color: isHighlight ? '#10b981' : '#7c3aed',
            } as Edge['markerEnd'],
          };
        }),
      );
    }
  }, [highlightedTables]);

  if (loading && nodes.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-violet-500" />
        <p>Loading schema visualization…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-destructive-border bg-background text-destructive-text">
        <p className="mb-4">{error}</p>
        <button onClick={() => fetchSchema()} className="rounded-lg bg-destructive-bg px-4 py-2 transition-colors hover:bg-destructive-text/20">
          Try Again
        </button>
      </div>
    );
  }

  // ── Shared graph content renderer ──────────────────────────────────────────
  const renderGraphContent = (fullscreen: boolean) => (
    <>
      {/* Stale data warning banner */}
      {staleWarning && (
        <div className="absolute left-4 right-24 top-4 z-10 flex items-center gap-2 rounded-lg border border-warning-border bg-warning-bg px-4 py-2 text-xs text-warning-text backdrop-blur">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning-text" />
          <span className="flex-1">{staleWarning}</span>
          <button
            onClick={() => fetchSchema()}
            className="shrink-0 rounded bg-warning-text/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-warning-text transition-colors hover:bg-warning-text/20"
          >
            Retry
          </button>
        </div>
      )}

      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <button
          onClick={() => fetchSchema()}
          className="rounded-lg border border-border bg-card/80 p-2 text-foreground/85 backdrop-blur transition-colors hover:bg-foreground/10"
          title="Refresh schema graph"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        {fullscreen ? (
          <button
            onClick={() => setIsFullscreen(false)}
            className="rounded-lg border border-border bg-card/80 p-2 text-foreground/85 backdrop-blur transition-colors hover:bg-rose-500/20 hover:text-rose-300"
            title="Close fullscreen"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setIsFullscreen(true)}
            className="rounded-lg border border-border bg-card/80 p-2 text-foreground/85 backdrop-blur transition-colors hover:bg-violet-500/20 hover:text-violet-300"
            title="Expand to fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <ReactFlow
        key={fullscreen ? 'fs' : 'inline'}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-background"
        defaultEdgeOptions={{ type: 'smoothstep' }}
        minZoom={0.1}
      >
        <Background color="#1e293b" gap={24} size={2} />
        <Controls className="border-border bg-card fill-foreground" />
        <MiniMap
          nodeColor={(n) => (n.data?.isHighlighted ? '#10b981' : '#334155')}
          maskColor="rgba(10, 12, 17, 0.7)"
          className="border border-border bg-card"
        />
      </ReactFlow>
    </>
  );

  // ── Fullscreen overlay ────────────────────────────────────────────────────
  if (isFullscreen) {
    return (
      <>
        {/* Keep inline placeholder so layout doesn't collapse */}
        <div className="relative h-full w-full overflow-hidden rounded-xl border border-border bg-background">
          <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
            <Maximize2 className="mb-2 h-6 w-6 text-violet-400" />
            <p className="text-sm">Graph is in fullscreen mode</p>
            <button
              onClick={() => setIsFullscreen(false)}
              className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/85 transition-colors hover:bg-foreground/[0.06]"
            >
              Exit Fullscreen
            </button>
          </div>
        </div>

        {/* Fullscreen overlay — fixed, covers entire viewport */}
        {createPortal(
          <div className="fixed inset-0 z-50 flex flex-col">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsFullscreen(false)}
            />
            {/* Graph container */}
            <div className="relative z-10 m-4 flex-1 overflow-hidden rounded-2xl border border-border bg-background shadow-[0_0_60px_rgba(139,92,246,0.15)]">
              {/* Title bar */}
              <div className="absolute left-4 top-4 z-10">
                <h3 className="font-display text-sm font-semibold tracking-wide text-foreground/90">
                  Schema Graph
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {nodes.length} table{nodes.length !== 1 ? 's' : ''} · {edges.length} relation{edges.length !== 1 ? 's' : ''}
                  </span>
                </h3>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Press Esc or click outside to close</p>
              </div>
              {renderGraphContent(true)}
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border bg-background">
      {renderGraphContent(false)}
    </div>
  );
}
