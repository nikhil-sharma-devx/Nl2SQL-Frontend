import { describe, it, expect } from 'vitest';
import { guessChartConfig, recommendChart, columnsFromRow } from './chart';

describe('guessChartConfig', () => {
  it('returns null for empty or missing data', () => {
    expect(guessChartConfig(null)).toBeNull();
    expect(guessChartConfig([])).toBeNull();
  });

  it('returns null when there is only a single column', () => {
    expect(guessChartConfig([{ total: 5 }])).toBeNull();
  });

  it('picks the first non-numeric column as X and the first numeric as Y', () => {
    const config = guessChartConfig([
      { category: 'A', revenue: 100, cost: 40 },
      { category: 'B', revenue: 200, cost: 90 },
    ]);
    expect(config).toEqual({ type: 'bar', x_axis: 'category', y_axis: 'revenue' });
  });

  it('falls back to another numeric column for X when no non-numeric column exists', () => {
    const config = guessChartConfig([{ year: 2024, sales: 500 }]);
    // year is numeric (first numeric -> Y), so X falls back to the next key.
    expect(config).toEqual({ type: 'bar', x_axis: 'sales', y_axis: 'year' });
  });

  it('returns null when no column is numeric', () => {
    expect(guessChartConfig([{ name: 'alice', city: 'NYC' }])).toBeNull();
  });
});

describe('recommendChart', () => {
  it('recommends a line chart for a temporal + numeric result', () => {
    const rec = recommendChart(
      [{ name: 'day', type: 'date' }, { name: 'revenue', type: 'float' }],
      [{ day: '2024-01-01', revenue: 10 }, { day: '2024-01-02', revenue: 20 }],
    );
    expect(rec.chart_type).toBe('line');
    expect(rec.x_axis).toBe('day');
    expect(rec.y_axis).toBe('revenue');
  });

  it('recommends a bar chart for a categorical + numeric result', () => {
    const rec = recommendChart(
      [{ name: 'category', type: 'text' }, { name: 'count', type: 'integer' }],
      [{ category: 'A', count: 3 }, { category: 'B', count: 5 }],
    );
    expect(rec.chart_type).toBe('bar');
    expect(rec.x_axis).toBe('category');
    expect(rec.y_axis).toBe('count');
  });

  it('recommends a histogram for a single numeric column with many rows', () => {
    const rec = recommendChart(
      [{ name: 'age', type: 'integer' }],
      [{ age: 20 }, { age: 21 }, { age: 22 }],
    );
    expect(rec.chart_type).toBe('histogram');
    expect(rec.y_axis).toBe('age');
  });

  it('recommends a KPI for a single scalar (one numeric column, one row)', () => {
    const rec = recommendChart([{ name: 'total', type: 'integer' }], [{ total: 42 }]);
    expect(rec.chart_type).toBe('kpi');
    expect(rec.y_axis).toBe('total');
  });

  it('recommends a map for geographic columns', () => {
    const rec = recommendChart(
      [{ name: 'latitude', type: 'float' }, { name: 'longitude', type: 'float' }],
      [{ latitude: 40.7, longitude: -74 }],
    );
    expect(rec.chart_type).toBe('map');
    expect(rec.x_axis).toBe('longitude');
    expect(rec.y_axis).toBe('latitude');
  });

  it('recommends a map when a place-name column is present', () => {
    const rec = recommendChart(
      [{ name: 'country', type: 'text' }, { name: 'sales', type: 'float' }],
      [{ country: 'US', sales: 100 }],
    );
    expect(rec.chart_type).toBe('map');
    expect(rec.x_axis).toBe('country');
  });

  it('recommends a scatter for exactly two numeric columns', () => {
    const rec = recommendChart(
      [{ name: 'height', type: 'float' }, { name: 'weight', type: 'float' }],
      [{ height: 1.8, weight: 80 }, { height: 1.6, weight: 60 }],
    );
    expect(rec.chart_type).toBe('scatter');
    expect(rec.x_axis).toBe('height');
    expect(rec.y_axis).toBe('weight');
  });

  it('falls back to a table when no clear mapping exists', () => {
    const rec = recommendChart(
      [{ name: 'name', type: 'text' }, { name: 'description', type: 'text' }],
      [{ name: 'alice', description: 'hello' }],
    );
    expect(rec.chart_type).toBe('table');
  });

  it('falls back to a table for an empty result set', () => {
    expect(recommendChart([], []).chart_type).toBe('table');
  });

  it('infers numeric columns from sample values when types are absent', () => {
    const cols = columnsFromRow({ category: 'A', revenue: 100 });
    const rec = recommendChart(cols, [{ category: 'A', revenue: 100 }]);
    expect(rec.chart_type).toBe('bar');
    expect(rec.x_axis).toBe('category');
    expect(rec.y_axis).toBe('revenue');
  });
});
