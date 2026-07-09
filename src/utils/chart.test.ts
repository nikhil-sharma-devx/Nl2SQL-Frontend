import { describe, it, expect } from 'vitest';
import { guessChartConfig } from './chart';

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
