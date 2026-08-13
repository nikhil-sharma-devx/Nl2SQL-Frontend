import { Suspense, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { Canvas } from '@react-three/fiber';
import { CameraControls, Float, Html, QuadraticBezierLine, Sparkles } from '@react-three/drei';
import { Loader2, RefreshCw, AlertTriangle, Maximize2, X, Search } from 'lucide-react';
import { useSchemaGraphData } from '@/hooks/useSchemaGraphData';
import { useThreeThemePalette } from './useThreeThemePalette';
import { cn } from '@/lib/utils';

type Vec3 = [number, number, number];

interface TableLayout {
  name: string;
  position: Vec3;
  columns: any[];
}

interface SchemaGraph3DProps {
  highlightedTables?: string[];
}

/** Evenly scatters N nodes across a sphere surface (golden-angle spiral) so
 * labels stay legible and don't cluster — radius grows with table count. */
function fibonacciSpherePositions(count: number, radius: number): Vec3[] {
  const points: Vec3[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = count > 1 ? 1 - (i / (count - 1)) * 2 : 0;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    points.push([Math.cos(theta) * r * radius, y * radius * 0.7, Math.sin(theta) * r * radius]);
  }
  return points;
}

function bowedMidpoint(a: Vec3, b: Vec3): Vec3 {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const mz = (a[2] + b[2]) / 2;
  return [mx * 1.18, my * 1.18, mz * 1.18];
}

function RelationshipLine({ from, to, active, color, activeColor }: { from: Vec3; to: Vec3; active: boolean; color: string; activeColor: string }) {
  const mid = useMemo(() => bowedMidpoint(from, to), [from, to]);
  return (
    <QuadraticBezierLine
      start={from}
      end={to}
      mid={mid}
      color={active ? activeColor : color}
      lineWidth={active ? 1.6 : 0.7}
      transparent
      opacity={active ? 0.85 : 0.22}
    />
  );
}

interface TableNode3DProps {
  table: TableLayout;
  isHighlighted: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  color: string;
  highlightColor: string;
  onHover: () => void;
  onLeave: () => void;
  onSelect: () => void;
}

function TableNode3D({ table, isHighlighted, isHovered, isDimmed, color, highlightColor, onHover, onLeave, onSelect }: TableNode3DProps) {
  const active = isHighlighted || isHovered;
  return (
    <Float speed={1} rotationIntensity={0.12} floatIntensity={0.55}>
      <Html position={table.position} center distanceFactor={9} style={{ transition: 'opacity 0.2s ease', opacity: isDimmed ? 0.32 : 1 }}>
        <button
          type="button"
          onMouseEnter={onHover}
          onMouseLeave={onLeave}
          onClick={onSelect}
          className="w-44 cursor-pointer rounded-xl border bg-popover/92 px-3 py-2 text-left font-sans backdrop-blur-xl transition-colors"
          style={{
            borderColor: active ? highlightColor : `${color}45`,
            boxShadow: active ? `0 0 20px ${highlightColor}55` : '0 10px 26px rgba(0,0,0,0.5)',
          }}
        >
          <div className="truncate font-display text-[12.5px] font-bold text-foreground">{table.name}</div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{table.columns.length} columns</div>
        </button>
      </Html>
    </Float>
  );
}

function Scene({
  tables,
  edges,
  highlightedTables,
  hoveredTable,
  setHoveredTable,
  setSelectedTable,
  controlsRef,
}: {
  tables: TableLayout[];
  edges: { source: string; target: string }[];
  highlightedTables: string[];
  hoveredTable: string | null;
  setHoveredTable: Dispatch<SetStateAction<string | null>>;
  setSelectedTable: Dispatch<SetStateAction<string | null>>;
  controlsRef: React.RefObject<any>;
}) {
  const palette = useThreeThemePalette();
  const byName = useMemo(() => new Map(tables.map((t) => [t.name, t])), [tables]);

  const isActive = (name: string) => hoveredTable === name || highlightedTables.includes(name);
  const anyActive = hoveredTable !== null || highlightedTables.length > 0;

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[6, 6, 6]} intensity={1} color={palette.chart2} />
      <pointLight position={[-6, -4, -4]} intensity={0.5} color={palette.chart3} />
      <CameraControls ref={controlsRef} makeDefault minDistance={3} maxDistance={40} />
      <Sparkles count={60} scale={16} size={1.4} speed={0.2} color={palette.chart3} opacity={0.3} />

      {edges.map((e) => {
        const from = byName.get(e.source)?.position;
        const to = byName.get(e.target)?.position;
        if (!from || !to) return null;
        return (
          <RelationshipLine
            key={`${e.source}-${e.target}`}
            from={from}
            to={to}
            active={isActive(e.source) || isActive(e.target)}
            color={palette.chart3}
            activeColor={palette.primary}
          />
        );
      })}

      {tables.map((table) => (
        <TableNode3D
          key={table.name}
          table={table}
          isHighlighted={highlightedTables.includes(table.name)}
          isHovered={hoveredTable === table.name}
          isDimmed={anyActive && !isActive(table.name)}
          color={palette.chart3}
          highlightColor={palette.primary}
          onHover={() => setHoveredTable(table.name)}
          onLeave={() => setHoveredTable((v) => (v === table.name ? null : v))}
          onSelect={() => setSelectedTable(table.name)}
        />
      ))}
    </>
  );
}

/**
 * 3D interactive schema explorer: tables as floating glass nodes, glowing
 * curved relationship lines, hover-highlight, click-for-detail, and a search
 * box that flies the camera to a matching table. Shares data/cache/retry
 * logic with the 2D fallback via `useSchemaGraphData` — this component only
 * owns layout and interaction.
 */
export default function SchemaGraph3D({ highlightedTables = [] }: SchemaGraph3DProps) {
  const { schema, loading, error, staleWarning, refetch } = useSchemaGraphData();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const controlsRef = useRef<any>(null);

  const { tables, edges } = useMemo(() => {
    if (!schema?.tables) return { tables: [] as TableLayout[], edges: [] as { source: string; target: string }[] };
    const radius = Math.max(3.5, Math.sqrt(schema.tables.length) * 2.3);
    const positions = fibonacciSpherePositions(schema.tables.length, radius);
    const laidOut: TableLayout[] = schema.tables.map((t: any, i: number) => ({
      name: t.name,
      position: positions[i],
      columns: t.columns,
    }));
    const rels: { source: string; target: string }[] = [];
    schema.tables.forEach((t: any) => {
      t.columns.forEach((col: any) => {
        if (col.foreign_key) rels.push({ source: t.name, target: col.foreign_key.split('.')[0] });
      });
    });
    return { tables: laidOut, edges: rels };
  }, [schema]);

  const selected = tables.find((t) => t.name === selectedTable) ?? null;

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return tables.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 6);
  }, [search, tables]);

  const flyTo = (table: TableLayout) => {
    const [x, y, z] = table.position;
    const dist = 1.7;
    controlsRef.current?.setLookAt(x * dist, y * dist + 1, z * dist, x, y, z, true);
    setSelectedTable(table.name);
    setSearch('');
  };

  if (loading && tables.length === 0) {
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

  const content = (fullscreen: boolean) => (
    <>
      {staleWarning && (
        <div className="absolute left-4 right-24 top-4 z-10 flex items-center gap-2 rounded-lg border border-warning-border bg-warning-bg px-4 py-2 text-xs text-warning-text backdrop-blur">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning-text" />
          <span className="flex-1">{staleWarning}</span>
          <button onClick={() => refetch()} className="shrink-0 rounded bg-warning-text/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-warning-text transition-colors hover:bg-warning-text/20">
            Retry
          </button>
        </div>
      )}

      {/* Search — flies the camera to a matching table (keyboard-reachable
          equivalent of clicking a node in 3D space). */}
      <div className="absolute left-4 top-4 z-10 w-56">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchResults[0]) flyTo(searchResults[0]);
            }}
            placeholder="Find a table…"
            className="w-full rounded-lg border border-border bg-card/85 py-1.5 pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground/50 backdrop-blur-xl focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        {searchResults.length > 0 && (
          <div className="mt-1 overflow-hidden rounded-lg border border-border bg-popover/95 backdrop-blur-xl">
            {searchResults.map((t) => (
              <button
                key={t.name}
                onClick={() => flyTo(t)}
                className="block w-full truncate px-3 py-1.5 text-left text-xs text-foreground/85 transition-colors hover:bg-foreground/[0.06]"
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <button
          onClick={() => refetch()}
          className="rounded-lg border border-border bg-card/80 p-2 text-foreground/85 backdrop-blur transition-colors hover:bg-foreground/10"
          title="Refresh schema graph"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
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

      {/* Detail panel for the clicked table */}
      {selected && (
        <div className="absolute bottom-4 right-4 z-10 max-h-[60%] w-72 overflow-hidden rounded-xl border border-border bg-popover/95 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-border bg-foreground/[0.04] px-3.5 py-2.5">
            <span className="font-display text-sm font-bold text-foreground">{selected.name}</span>
            <button onClick={() => setSelectedTable(null)} className="text-muted-foreground transition-colors hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto custom-scrollbar p-2">
            {selected.columns.map((col: any) => (
              <div key={col.name} className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-foreground/5">
                <div className="flex items-center gap-1.5">
                  <span className={col.primary_key ? 'font-bold text-warning-text' : 'text-foreground/85'}>{col.name}</span>
                  {col.primary_key && <span className="text-[10px] text-warning-text/80">(PK)</span>}
                  {col.foreign_key && <span className="text-[10px] text-violet-text/80">(FK)</span>}
                </div>
                <span className="font-mono text-[10px] text-muted-foreground/80">{col.data_type?.split('(')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Canvas camera={{ position: [0, 2, 12], fov: 50 }} gl={{ alpha: true, antialias: true }}>
        <Suspense fallback={null}>
          <Scene
            tables={tables}
            edges={edges}
            highlightedTables={highlightedTables}
            hoveredTable={hoveredTable}
            setHoveredTable={setHoveredTable}
            setSelectedTable={setSelectedTable}
            controlsRef={controlsRef}
          />
        </Suspense>
      </Canvas>
    </>
  );

  if (isFullscreen) {
    return (
      <>
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
        {createPortal(
          <div className="fixed inset-0 z-50 flex flex-col">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsFullscreen(false)} />
            <div className="relative z-10 m-4 flex-1 overflow-hidden rounded-2xl border border-border bg-background shadow-[0_0_60px_rgba(139,92,246,0.15)]">
              {content(true)}
            </div>
          </div>,
          document.body,
        )}
      </>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border bg-background">
      {content(false)}
    </div>
  );
}
