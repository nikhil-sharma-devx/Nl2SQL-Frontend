/**
 * Query-related TypeScript interfaces.
 *
 * Types for QueryRequest (user message payload), QueryResponse (SQL + result),
 * and the streaming event shape.
 */

export interface QueryRequest {
  question: string;
  dialect?: string;
  execute?: boolean;
  session_id?: string;
}

export interface QueryResponse {
  question: string;
  sql: string;
  dialect: string;
  is_valid: boolean;
  validation_errors: string[];
  retrieved_tables: string[];
  used_tables: string[];
  execution_result: Record<string, unknown>[] | null;
  execution_error?: string;
  tokens_used: number;
  cached: boolean;
  message?: string;
  intent_type?: string | null;
  query_complexity?: number;
  prompt_version?: string;
  retrieval_method?: string;
  // API can return null for timing fields; match api/client.ts's QueryResponse
  // so session messages (SessionDetail) are assignable to ChatMessage[].
  response_time_ms?: number | null;
  suggested_chart?: {
    type: string;
    x_axis: string;
    y_axis: string;
  } | null;
  follow_up_questions?: string[];
}

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
