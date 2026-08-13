import { useState, useEffect } from 'react';
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
import { Loader2, RefreshCw, AlertTriangle, Maximize2, X } from 'lucide-react';
import { useSchemaGraphData } from '../hooks/useSchemaGraphData';

// ── Custom Table Node Component ───────────────────────────────────────────────
const TableNode = ({ data, selected }: { data: any; selected: boolean }) => {
  const isHighlighted = data.isHighlighted;

  return (
    <div
      className={`w-64 overflow-hidden rounded-xl border font-sans text-sm backdrop-blur-xl transition-all ${
        selected
          ? 'border-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.4)]'
          : isHighlighted
          ? 'border-primary shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_40%,transparent)] ring-2 ring-primary/50'
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
            // Edge `style` is applied as an inline style on the SVG path, so
            // CSS design tokens resolve here (primary = highlighted, violet = default).
            stroke: highlightedTables.includes(table.name) ? 'var(--primary)' : 'var(--violet-text)',
            strokeWidth: 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            // React Flow renders the marker arrow with inline style, so var() works.
            color: highlightedTables.includes(table.name) ? 'var(--primary)' : 'var(--violet-text)',
          },
        });
      }
    });
  });

  return { newNodes, newEdges };
}

export default function SchemaGraph({ highlightedTables = [] }: SchemaGraphProps) {
  const { schema, loading, error, staleWarning, refetch } = useSchemaGraphData();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Full layout rebuild whenever the underlying schema changes (initial load
  // or manual refresh) — uses whichever `highlightedTables` is current.
  useEffect(() => {
    if (schema?.tables) {
      const { newNodes, newEdges } = buildNodesAndEdges(schema, highlightedTables);
      setNodes(newNodes);
      setEdges(newEdges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- highlight-only
    // changes are handled by the effect below without a full rebuild.
  }, [schema]);

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
              stroke: isHighlight ? 'var(--primary)' : 'var(--violet-text)',
            },
            markerEnd: {
              ...(edge.markerEnd as Record<string, unknown>),
              color: isHighlight ? 'var(--primary)' : 'var(--violet-text)',
            } as Edge['markerEnd'],
          };
        }),
      );
    }
  }, [highlightedTables]);

  if (loading && nodes.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-violet-text" />
        <p>Loading schema visualization…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-destructive-border bg-background text-destructive-text">
        <p className="mb-4">{error}</p>
        <button onClick={() => refetch()} className="rounded-lg bg-destructive-bg px-4 py-2 transition-colors hover:bg-destructive-text/20">
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
            onClick={() => refetch()}
            className="shrink-0 rounded bg-warning-text/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-warning-text transition-colors hover:bg-warning-text/20"
          >
            Retry
          </button>
        </div>
      )}

      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <button
          onClick={() => refetch()}
          className="rounded-lg border border-border bg-card/80 p-2 text-foreground/85 backdrop-blur transition-colors hover:bg-foreground/10"
          title="Refresh schema graph"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        {fullscreen ? (
          <button
            onClick={() => setIsFullscreen(false)}
            className="rounded-lg border border-border bg-card/80 p-2 text-foreground/85 backdrop-blur transition-colors hover:bg-destructive-bg hover:text-destructive-text"
            title="Close fullscreen"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setIsFullscreen(true)}
            className="rounded-lg border border-border bg-card/80 p-2 text-foreground/85 backdrop-blur transition-colors hover:bg-violet-bg hover:text-violet-text"
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
        {/* Background/MiniMap colors below are written to SVG presentation
            attributes (fill/color), where CSS var() does NOT resolve, so they
            stay as concrete strings. */}
        <Background color="#1e293b" gap={24} size={2} />
        <Controls className="border-border bg-card fill-foreground" />
        <MiniMap
          nodeColor={(n) => (n.data?.isHighlighted ? '#c8903f' : '#334155')}
          maskColor="rgba(11, 17, 25, 0.7)"
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
            <Maximize2 className="mb-2 h-6 w-6 text-violet-text" />
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
