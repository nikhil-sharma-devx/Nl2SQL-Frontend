import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ResultTable from './ResultTable';
import type { QueryResponse } from '../types/query.types';

// These tests render via react-dom directly (see src/test/setup.ts for why we
// don't use @testing-library/react here).

let container: HTMLDivElement;
let root: Root;

function makeResponse(): QueryResponse {
  return {
    question: 'top customers',
    sql: 'SELECT name, amount FROM t',
    dialect: 'postgresql',
    is_valid: true,
    validation_errors: [],
    retrieved_tables: [],
    used_tables: [],
    execution_result: [
      { name: 'Charlie', amount: 30 },
      { name: 'alice', amount: 10 },
      { name: 'Bob', amount: 20 },
    ],
    tokens_used: 0,
    cached: false,
    response_time_ms: 5,
  };
}

function renderTable(response: QueryResponse) {
  act(() => {
    root.render(<ResultTable response={response} />);
  });
}

function headerCells(): HTMLTableCellElement[] {
  return Array.from(container.querySelectorAll('thead th'));
}

function firstColumnValues(): string[] {
  return Array.from(container.querySelectorAll('tbody tr td:first-child')).map(
    (td) => td.textContent?.trim() ?? '',
  );
}

function findByExactText(selector: string, text: string): HTMLElement {
  const el = Array.from(container.querySelectorAll<HTMLElement>(selector)).find(
    (node) => node.textContent?.trim() === text,
  );
  if (!el) throw new Error(`No <${selector}> with text "${text}"`);
  return el;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // jsdom has no clipboard by default — provide a spy.
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ResultTable', () => {
  it('renders column headers and all row values', () => {
    renderTable(makeResponse());
    const headers = headerCells().map((th) => th.textContent?.trim());
    expect(headers).toEqual(['name', 'amount']);
    expect(container.textContent).toContain('Charlie');
    expect(container.textContent).toContain('alice');
    expect(container.textContent).toContain('Bob');
  });

  it('right-aligns the numeric column header', () => {
    renderTable(makeResponse());
    const amountHeader = findByExactText('th', 'amount');
    expect(amountHeader.className).toContain('text-right');
    // The non-numeric column must NOT be right-aligned.
    expect(findByExactText('th', 'name').className).not.toContain('text-right');
  });

  it('sorts ascending (case-insensitive) when a column header is clicked', () => {
    renderTable(makeResponse());
    expect(firstColumnValues()).toEqual(['Charlie', 'alice', 'Bob']);

    act(() => {
      findByExactText('th', 'name').click();
    });

    expect(firstColumnValues()).toEqual(['alice', 'Bob', 'Charlie']);
  });

  it('copies the raw cell value to the clipboard when a cell is clicked', () => {
    renderTable(makeResponse());
    // Click the numeric cell "30" — the copied value must be the raw string,
    // not a locale-formatted display value.
    act(() => {
      findByExactText('td', '30').click();
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('30');
  });
});
