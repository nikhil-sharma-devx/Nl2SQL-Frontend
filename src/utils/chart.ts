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
