/**
 * Query-related TypeScript interfaces.
 *
 * QueryRequest (user message payload) and QueryResponse (SQL + result) are
 * derived from the generated OpenAPI schema so they can never drift from the
 * backend contract. ChatMessage / StreamEvent build on them.
 */
import type { components } from '../api/schema';

type Schemas = components['schemas'];

export type QueryRequest = Schemas['QueryRequest'];
// Optional multi-turn clarification fields — present before `npm run gen:api`
// regenerates schema.d.ts, and backwards-compatible when absent.
export type QueryResponse = Schemas['QueryResponse'] & {
  needs_clarification?: boolean;
  clarification_prompt?: string | null;
};

export interface ChatMessage {
  id: number;
  question: string;
  timestamp: string;
  response: QueryResponse;
}

/**
 * SSE streaming event shapes for future streaming support.
 */
export interface StreamEvent {
  status: 'started' | 'progress' | 'complete' | 'error';
  stage?: string;
  cached?: boolean;
  data?: QueryResponse;
  sql?: string;
  tables?: string[];
  error?: string;
  type?: string;
  response_time_ms?: number;
}
