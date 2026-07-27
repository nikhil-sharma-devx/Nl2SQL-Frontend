/**
 * Chart inference helpers (pure, dependency-free — unit-testable in isolation).
 */

export interface ChartConfig {
  type: string;
  x_axis: string;
  y_axis: string;
}

/**
 * Infer a sensible default chart config from a result set: the first numeric
 * column becomes the Y axis and the first non-numeric column (falling back to
 * any other column) becomes the X axis. Returns null when the data can't drive
 * a chart (empty, single-column, or no numeric column).
 */
export function guessChartConfig(data: any[] | null): ChartConfig | null {
  if (!data || data.length === 0) return null;
  const firstRow = data[0];
  const keys = Object.keys(firstRow);
  if (keys.length < 2) return null;

  const numericKeys = keys.filter((k) => typeof firstRow[k] === 'number');
  const nonNumericKeys = keys.filter((k) => typeof firstRow[k] !== 'number');

  if (numericKeys.length > 0) {
    const yAxis = numericKeys[0];
    const xAxis = nonNumericKeys.length > 0 ? nonNumericKeys[0] : keys.filter((k) => k !== yAxis)[0];
    return {
      type: 'bar',
      x_axis: xAxis,
      y_axis: yAxis,
    };
  }
  return null;
}

// ── Auto chart recommendation ────────────────────────────────────────────────
// Deterministic, dependency-free heuristic mirroring the backend
// `DashboardService.recommend_chart`. Produces the default visualization for a
// dashboard widget from its result set.

export type ChartType = 'line' | 'bar' | 'pie' | 'histogram' | 'kpi' | 'map' | 'scatter' | 'table';

export interface ColumnMeta {
  name: string;
  type?: string;
}

export interface ChartRecommendation {
  chart_type: ChartType;
  x_axis: string | null;
  y_axis: string | null;
  reason: string;
}

const NUMERIC_TYPES = ['int', 'float', 'double', 'real', 'numeric', 'decimal', 'money', 'serial', 'number'];
const TEMPORAL_TYPES = ['date', 'time', 'timestamp', 'datetime', 'year'];
const GEO_NAMES = new Set(['country', 'region', 'state', 'city', 'province', 'county', 'postcode', 'zip']);
const LAT_NAMES = new Set(['lat', 'latitude']);
const LON_NAMES = new Set(['lon', 'lng', 'long', 'longitude']);
const MAX_BAR_CARDINALITY = 50;

const typeStr = (c: ColumnMeta): string => (c.type ?? '').toLowerCase();

function sampleValue(rows: any[], name: string): unknown {
  for (const row of rows) {
    if (row?.[name] !== null && row?.[name] !== undefined) return row[name];
  }
  return undefined;
}

function isNumeric(c: ColumnMeta, rows: any[]): boolean {
  const t = typeStr(c);
  if (NUMERIC_TYPES.some((frag) => t.includes(frag))) return true;
  if (!t) {
    const v = sampleValue(rows, c.name);
    if (typeof v === 'boolean') return false;
    if (typeof v === 'number') return true;
  }
  return false;
}

function isTemporal(c: ColumnMeta): boolean {
  const t = typeStr(c);
  if (TEMPORAL_TYPES.some((frag) => t.includes(frag))) return true;
  const n = c.name.toLowerCase();
  return (
    ['date', 'day', 'month', 'year', 'week', 'timestamp'].includes(n) ||
    n.endsWith('_date') ||
    n.endsWith('_at') ||
    n.endsWith('_time')
  );
}

function isGeo(c: ColumnMeta): boolean {
  const n = c.name.toLowerCase();
  return GEO_NAMES.has(n) || LAT_NAMES.has(n) || LON_NAMES.has(n);
}

/**
 * Recommend the best visualization for a result set. Priority order:
 * geography → map, single scalar → kpi, temporal+numeric → line,
 * two numeric → scatter, categorical+numeric → bar, single numeric → histogram,
 * else → table.
 */
export function recommendChart(columns: ColumnMeta[], rows: any[]): ChartRecommendation {
  const cols = (columns ?? []).filter((c) => c && c.name);
  const data = rows ?? [];

  if (cols.length === 0) {
    return { chart_type: 'table', x_axis: null, y_axis: null, reason: 'No columns to plot; showing a table.' };
  }

  const numeric = cols.filter((c) => isNumeric(c, data));
  const temporal = cols.filter((c) => isTemporal(c));
  const geo = cols.filter((c) => isGeo(c));
  const categorical = cols.filter((c) => !numeric.includes(c) && !temporal.includes(c) && !geo.includes(c));

  // 1. Geography → map
  if (geo.length > 0) {
    const lat = cols.find((c) => LAT_NAMES.has(c.name.toLowerCase()));
    const lon = cols.find((c) => LON_NAMES.has(c.name.toLowerCase()));
    if (lat && lon) {
      return { chart_type: 'map', x_axis: lon.name, y_axis: lat.name, reason: 'Latitude/longitude columns detected; plotting a map.' };
    }
    return {
      chart_type: 'map',
      x_axis: geo[0].name,
      y_axis: numeric.length > 0 ? numeric[0].name : null,
      reason: 'A geographic column was detected; plotting a map.',
    };
  }

  // 2. Single numeric scalar → KPI
  if (cols.length === 1 && numeric.length === 1 && data.length <= 1) {
    return { chart_type: 'kpi', x_axis: null, y_axis: numeric[0].name, reason: 'A single numeric value; showing a KPI metric.' };
  }

  // 3. Time series → line
  if (temporal.length > 0 && numeric.length > 0) {
    return { chart_type: 'line', x_axis: temporal[0].name, y_axis: numeric[0].name, reason: 'A date/time column with a numeric measure; plotting a line chart.' };
  }

  // 4. Two numeric columns → scatter
  if (cols.length === 2 && numeric.length === 2) {
    return { chart_type: 'scatter', x_axis: numeric[0].name, y_axis: numeric[1].name, reason: 'Two numeric columns; plotting a scatter chart.' };
  }

  // 5. Low-cardinality categorical + numeric → bar
  if (categorical.length > 0 && numeric.length > 0) {
    const cat = categorical[0];
    const distinct = data.length ? new Set(data.map((r) => r?.[cat.name])).size : 0;
    if (distinct <= MAX_BAR_CARDINALITY) {
      return { chart_type: 'bar', x_axis: cat.name, y_axis: numeric[0].name, reason: 'A categorical column with a numeric measure; plotting a bar chart.' };
    }
  }

  // 6. Single numeric column across many rows → histogram
  if (numeric.length === 1 && cols.length === 1) {
    return { chart_type: 'histogram', x_axis: numeric[0].name, y_axis: numeric[0].name, reason: 'One numeric column; showing its distribution as a histogram.' };
  }

  // 7. Fallback → table
  return { chart_type: 'table', x_axis: null, y_axis: null, reason: 'No clear chart mapping; showing a table.' };
}

/** Derive ColumnMeta from a plain result row (used when the API returns only rows). */
export function columnsFromRow(row: Record<string, unknown> | undefined | null): ColumnMeta[] {
  if (!row) return [];
  return Object.keys(row).map((name) => ({
    name,
    type: typeof row[name] === 'number' ? 'number' : typeof row[name] === 'boolean' ? 'boolean' : 'text',
  }));
}
