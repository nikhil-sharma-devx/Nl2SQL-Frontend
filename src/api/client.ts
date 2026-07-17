import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import {
  clearTokens,
  getRefreshToken,
  getToken,
  setRefreshToken,
  setToken,
} from '../auth/tokenStore';
import { toast } from '../components/ui/toast';
import type { components } from './schema';

/** Generated OpenAPI schema types — single source of truth for the API contract. */
type Schemas = components['schemas'];

/**
 * Typed error raised for every failed API call.
 * Mirrors the backend error envelope: {code, message, request_id, retry_after}.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly requestId: string | null;
  readonly retryAfter: number | null;

  constructor(opts: {
    message: string;
    code?: string;
    status?: number | null;
    requestId?: string | null;
    retryAfter?: number | null;
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.code = opts.code ?? 'UNKNOWN_ERROR';
    this.status = opts.status ?? null;
    this.requestId = opts.requestId ?? null;
    this.retryAfter = opts.retryAfter ?? null;
  }
}

// Query types
export type QueryRequest = Schemas['QueryRequest'];

export type QueryResponse = Schemas['QueryResponse'];

/**
 * Pipeline stages streamed over SSE. Mirrors the backend `PipelineStage`
 * union in `core/models/query.py` — keep both in sync.
 */
export type PipelineStage =
  | 'initializing'
  | 'retrieving_schema'
  | 'schema_retrieved'
  | 'generating_sql'
  | 'sql_generated'
  | 'validating_sql'
  | 'executing_sql';

/** A single Server-Sent Event frame from POST /query/stream. */
export interface PipelineStageEvent {
  status: 'started' | 'progress' | 'complete' | 'error';
  stage?: PipelineStage;
  tables?: string[];
  sql?: string;
  cached?: boolean;
  data?: QueryResponse;
  response_time_ms?: number;
  error?: string;
  type?: string;
}

export type ExplainResponse = Schemas['ExplainResponse'];

export type SuggestionRequest = Schemas['SuggestionRequest'];

export type SuggestionResponse = Schemas['SuggestionResponse'];

export type ExecuteRequest = Schemas['ExecuteRequest'];

export type ExecuteResponse = Schemas['ExecuteResponse'];

// Schema types
export type IngestResponse = Schemas['IngestResponse'];

export type SchemaStatusResponse = Schemas['SchemaStatusResponse'];

export type SchemaRefreshResponse = Schemas['SchemaRefreshResponse'];

// Schema catalog (per-user Schema page read model)
export type CatalogColumn = Schemas['CatalogColumn'];

export type CatalogTable = Schemas['CatalogTable'];

export type SchemaTablesResponse = Schemas['SchemaTablesResponse'];

export type SchemaSyncResponse = Schemas['SyncResponse'];

// Config types
export interface LLMConfig {
  provider: string;
  model: string;
  available_providers: string[];
}

export interface ModelsMap {
  [provider: string]: string[];
}

export interface UpdateLLMRequest {
  provider: string;
  model: string;
}

export interface UpdateLLMResponse {
  provider: string;
  model: string;
  message: string;
}

export interface DatabaseConfig {
  database_url: string;
  available_databases?: Record<string, string>;
}

export interface UpdateDatabaseRequest {
  database_url: string;
}

export interface UpdateDatabaseResponse {
  database_url: string;
  message: string;
}

// Phase 3 RAG quality configuration (runtime-adjustable feature flags)
export interface RagConfig {
  schema_descriptions_enabled: boolean;
  multi_query_enabled: boolean;
  multi_query_max: number;
  few_shot_retrieval_enabled: boolean;
  few_shot_top_k: number;
  parent_child_chunking_enabled: boolean;
  hyde_enabled: boolean;
  adaptive_top_k_enabled: boolean;
  adaptive_top_k_min: number;
  adaptive_top_k_max: number;
}

export type RagConfigUpdate = Partial<RagConfig>;

// History types
export interface HistoryEntry {
  id: number;
  timestamp: string;
  query_response: QueryResponse;
}

export type HistoryListResponse = Schemas['HistoryListResponse'];

// Session types
export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface SessionDetail {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: {
    id: number;
    question: string;
    timestamp: string;
    response: QueryResponse;
  }[];
}

export type SessionListResponse = Schemas['SessionListResponse'];

// Create axios instance
const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token (in-memory) to every request
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

/**
 * When the server rejects our token (401) and it can't be refreshed, the stored
 * session is stale or revoked. Clear it and send the user back to the login
 * screen so a fresh, valid token can be minted — rather than surfacing a
 * confusing error.
 */
export const forceReauth = (): void => {
  try {
    localStorage.removeItem('nl2sql_user');
    clearTokens();
  } catch {
    // ignore storage errors
  }
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
    window.location.assign('/auth');
  }
};

/**
 * Single-flight refresh: concurrent 401s share one in-flight refresh request so
 * we mint exactly one new token pair. Resolves to the new access token, or null
 * when refresh is impossible (no refresh token) or rejected (expired/revoked).
 */
let refreshPromise: Promise<string | null> | null = null;

const performTokenRefresh = async (): Promise<string | null> => {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    // Use a bare axios call (not apiClient) so this request bypasses the
    // interceptors below and can never recurse into another refresh attempt.
    const { data } = await axios.post(
      `${apiClient.defaults.baseURL}/auth/refresh`,
      { refresh_token: refresh },
      { headers: { 'Content-Type': 'application/json' } },
    );
    const accessToken: string = data.access_token;
    setToken(accessToken);
    setRefreshToken(data.refresh_token);
    // Keep the shared axios default header (used by AuthContext's raw calls) fresh.
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    return accessToken;
  } catch {
    return null;
  }
};

const refreshAccessToken = (): Promise<string | null> => {
  refreshPromise = refreshPromise ?? performTokenRefresh();
  const p = refreshPromise;
  // Reset the shared slot once this attempt settles so the next 401 can retry.
  void p.finally(() => {
    if (refreshPromise === p) refreshPromise = null;
  });
  return p;
};

/** Extract the human-readable message from a backend error payload. */
const extractErrorMessage = (data: any, status: number): string => {
  if (data) {
    // FastAPI ValidationError returns detail as an array of objects
    if (Array.isArray(data.detail)) {
      return data.detail.map((err: any) => err.msg || JSON.stringify(err)).join(', ');
    }
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.message === 'string') return data.message;
  }
  return `Error: ${status}`;
};

/** Map an axios failure to a typed ApiError carrying the backend envelope. */
const toApiError = (error: AxiosError<any>): ApiError => {
  const status = error.response?.status ?? null;
  const data = error.response?.data;
  const headers = error.response?.headers as Record<string, string> | undefined;
  const retryAfterHeader = headers?.['retry-after'];

  return new ApiError({
    message: error.response
      ? extractErrorMessage(data, error.response.status)
      : error.message || 'Network error occurred',
    code: data?.code ?? (status ? `HTTP_${status}` : 'NETWORK_ERROR'),
    status,
    requestId: data?.request_id ?? headers?.['x-request-id'] ?? null,
    retryAfter:
      data?.retry_after ?? (retryAfterHeader ? parseInt(retryAfterHeader, 10) : null),
  });
};

/** Show a central toast for an ApiError (skips 401 — handled by re-auth redirect). */
const notifyApiError = (err: ApiError): void => {
  if (err.status === 401) return;
  const title =
    err.status === 429
      ? `Slow down — rate limit hit${err.retryAfter ? `, retry in ${err.retryAfter}s` : ''}`
      : err.message;
  toast({
    title,
    description: err.requestId ? `Reference: ${err.requestId}` : undefined,
    variant: 'error',
  });
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error)) {
      const original = error.config as
        | (InternalAxiosRequestConfig & { _retry?: boolean })
        | undefined;
      const status = error.response?.status;

      // On a 401, transparently refresh the access token once and retry the
      // original request. Never retry the refresh call itself, and never loop.
      const isAuthEndpoint =
        original?.url?.includes('/auth/refresh') ||
        original?.url?.includes('/auth/login');
      if (status === 401 && original && !original._retry && !isAuthEndpoint) {
        original._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          original.headers = original.headers ?? {};
          original.headers['Authorization'] = `Bearer ${newToken}`;
          return apiClient(original);
        }
        forceReauth();
        return Promise.reject(toApiError(error));
      }

      if (status === 401) {
        forceReauth();
        return Promise.reject(toApiError(error));
      }

      const apiError = toApiError(error);
      notifyApiError(apiError);
      return Promise.reject(apiError);
    }
    return Promise.reject(error);
  },
);

// Error handler helper — accepts both ApiError (from the interceptor) and raw
// axios/unknown errors (e.g. from fetch-based streaming).
export const handleApiError = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.requestId ? `${error.message} (Ref: ${error.requestId})` : error.message;
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: any; message?: string }>;
    if (axiosError.response?.data) {
      return extractErrorMessage(axiosError.response.data, axiosError.response.status);
    }
    return axiosError.message || 'Network error occurred';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
};

// API functions
export const forgotPassword = async (email: string): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
  return response.data;
};

export const resetPassword = async (email: string, otp_code: string, new_password: string): Promise<any> => {
  const response = await apiClient.post('/auth/reset-password', { email, otp_code, new_password });
  return response.data;
};

export const postQuery = async (req: QueryRequest): Promise<QueryResponse> => {
  const response = await apiClient.post<QueryResponse>('/query', req);
  return response.data;
};

export const streamQuery = async (
  req: QueryRequest,
  onChunk: (chunk: any) => void,
  signal?: AbortSignal
): Promise<void> => {
  const token = getToken();
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch('/api/v1/query/stream', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(req),
    signal,
  });

  if (!response.ok) {
    if (response.status === 401) {
      forceReauth();
    }
    let errorData = {};
    try {
      errorData = await response.json();
    } catch (e) {
      // Ignored
    }
    // Format error to match AxiosError structure expected by handleApiError
    throw { response: { status: response.status, data: errorData }, isAxiosError: true };
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No readable stream available');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6).trim();
          if (dataStr === '[DONE]') continue;
          
          let data;
          try {
            data = JSON.parse(dataStr);
          } catch (e) {
            console.error('Failed to parse stream chunk:', e, dataStr);
            continue;
          }
          onChunk(data);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
};

export const explainSQL = async (sql: string): Promise<ExplainResponse> => {
  const response = await apiClient.post<ExplainResponse>('/query/explain', { sql });
  return response.data;
};

export const getSuggestions = async (req: SuggestionRequest): Promise<SuggestionResponse> => {
  const response = await apiClient.post<SuggestionResponse>('/query/suggestions', req);
  return response.data;
};

export const executeSQL = async (req: ExecuteRequest): Promise<ExecuteResponse> => {
  const response = await apiClient.post<ExecuteResponse>('/query/execute', req);
  return response.data;
};

export const uploadSchema = async (file: File, reset: boolean): Promise<IngestResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('reset', reset.toString());

  const response = await apiClient.post<IngestResponse>('/schema/ingest', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getSchemaStatus = async (): Promise<SchemaStatusResponse> => {
  const response = await apiClient.get<SchemaStatusResponse>('/schema/status');
  return response.data;
};

export const refreshSchema = async (schemaName = 'public'): Promise<SchemaRefreshResponse> => {
  const response = await apiClient.post<SchemaRefreshResponse>('/schema/refresh', null, {
    params: { schema_name: schemaName },
  });
  return response.data;
};

export const getVisualizeSchema = async (schemaName = 'public'): Promise<any> => {
  const response = await apiClient.get<any>('/schema/visualize', {
    params: { schema_name: schemaName },
    timeout: 120000, // 2 min — allow extra room for cold-start / pooled DB connections
  });
  return response.data;
};

// ── Schema catalog (per-user Schema page) ─────────────────────────────────────

export const getSchemaTables = async (schemaName?: string): Promise<SchemaTablesResponse> => {
  const response = await apiClient.get<SchemaTablesResponse>('/schema/tables', {
    params: schemaName ? { schema_name: schemaName } : undefined,
  });
  return response.data;
};

export const syncSchema = async (schemaName = 'public'): Promise<SchemaSyncResponse> => {
  const response = await apiClient.post<SchemaSyncResponse>('/schema/sync', null, {
    params: { schema_name: schemaName },
    timeout: 120000,
  });
  return response.data;
};

export const setTableDescription = async (
  id: number,
  user_description: string | null,
): Promise<CatalogTable> => {
  const response = await apiClient.patch<CatalogTable>(`/schema/tables/${id}`, { user_description });
  return response.data;
};

export const markTablesSeen = async (table_ids: number[]): Promise<{ updated: number }> => {
  const response = await apiClient.post<{ updated: number }>('/schema/tables/seen', { table_ids });
  return response.data;
};

export const getDatabaseConfig = async (): Promise<DatabaseConfig> => {
  const response = await apiClient.get<DatabaseConfig>('/config/database');
  return response.data;
};

export const updateDatabaseConfig = async (database_url: string): Promise<UpdateDatabaseResponse> => {
  const response = await apiClient.put<UpdateDatabaseResponse>('/config/database', { database_url });
  return response.data;
};

export const getLLMConfig = async (): Promise<LLMConfig> => {
  const response = await apiClient.get<LLMConfig>('/config/llm');
  return response.data;
};

export const updateLLMConfig = async (req: UpdateLLMRequest): Promise<UpdateLLMResponse> => {
  const response = await apiClient.put<UpdateLLMResponse>('/config/llm', req);
  return response.data;
};

export const getAvailableModels = async (): Promise<ModelsMap> => {
  const response = await apiClient.get<ModelsMap>('/config/models');
  return response.data;
};

export const getRagConfig = async (): Promise<RagConfig> => {
  const response = await apiClient.get<RagConfig>('/config/rag');
  return response.data;
};

export const updateRagConfig = async (updates: RagConfigUpdate): Promise<RagConfig> => {
  const response = await apiClient.put<RagConfig>('/config/rag', updates);
  return response.data;
};

export const getHistory = async (limit = 50, offset = 0): Promise<HistoryListResponse> => {
  const response = await apiClient.get<HistoryListResponse>('/history', {
    params: { limit, offset },
  });
  return response.data;
};

export const clearHistory = async (): Promise<void> => {
  await apiClient.delete('/history');
};

// Session API functions
export const createSession = async (): Promise<{ id: string; title: string; created_at: string; updated_at: string }> => {
  const response = await apiClient.post('/sessions');
  return response.data;
};

export const getSessions = async (limit = 50, offset = 0): Promise<SessionListResponse> => {
  const response = await apiClient.get('/sessions', {
    params: { limit, offset },
  });
  return response.data;
};

export const getSession = async (sessionId: string): Promise<SessionDetail> => {
  const response = await apiClient.get(`/sessions/${sessionId}`);
  return response.data;
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  await apiClient.delete(`/sessions/${sessionId}`);
};

export const deleteAllSessions = async (): Promise<void> => {
  await apiClient.delete('/sessions');
};

export type AddMessageRequest = Schemas['AddMessageRequest'];

export const addSessionMessage = async (sessionId: string, req: AddMessageRequest): Promise<any> => {
  const response = await apiClient.post(`/sessions/${sessionId}/messages`, req);
  return response.data;
};

export const checkHealth = async (): Promise<boolean> => {
  try {
    await apiClient.get('/health', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
};

// SQL Version Management functions
export type SaveVersionRequest = Schemas['SaveVersionRequest'];

export type SaveVersionResponse = Schemas['SaveVersionResponse'];

export interface SQLVersion {
  version: number;
  sql: string;
  results?: Record<string, any>[];
  success: boolean;
  timestamp: Date;
  is_original: boolean;
}

export const saveSQLVersion = async (data: SaveVersionRequest): Promise<SaveVersionResponse> => {
  const response = await apiClient.post('/query/save-version', data);
  return response.data;
};

export const getSQLVersions = async (messageId: number): Promise<{ versions: SQLVersion[]; total_versions: number }> => {
  const response = await apiClient.get(`/query/versions/${messageId}`);
  return response.data;
};

// Analytics API functions
export const analyticsAPI = {
  getSummary: async (days = 30) => {
    const response = await apiClient.get('/analytics/summary', { params: { days } });
    return response.data;
  },
  getPopularQueries: async (limit = 10, days = 30) => {
    const response = await apiClient.get('/analytics/popular-queries', { params: { limit, days } });
    return response.data;
  },
  getFailurePatterns: async (days = 30) => {
    const response = await apiClient.get('/analytics/failure-patterns', { params: { days } });
    return response.data;
  },
  getTableUsage: async (limit = 20, days = 30) => {
    const response = await apiClient.get('/analytics/table-usage', { params: { limit, days } });
    return response.data;
  },
  getIntentDistribution: async (days = 30) => {
    const response = await apiClient.get('/analytics/intent-distribution', { params: { days } });
    return response.data;
  },
  getPromptVersions: async (days = 30) => {
    const response = await apiClient.get('/analytics/prompt-versions', { params: { days } });
    return response.data;
  },
  resetAnalytics: async () => {
    const response = await apiClient.delete('/analytics/reset');
    return response.data;
  },
  getCacheStats: async (): Promise<CacheStats> => {
    const response = await apiClient.get('/analytics/cache-stats');
    return response.data;
  },
  getLatencyBreakdown: async (): Promise<LatencyBreakdown> => {
    const response = await apiClient.get('/analytics/latency-breakdown');
    return response.data;
  },
};

export type LatencyBreakdown = Schemas['LatencyBreakdown'];

export type CacheStats = Schemas['CacheStats'];

export type DeepHealthResponse = Schemas['DeepHealthResponse'];

export const getDeepHealth = async (): Promise<DeepHealthResponse> => {
  const response = await apiClient.get<DeepHealthResponse>('/health/deep');
  return response.data;
};

// ── Profile / BYOK API ────────────────────────────────────────────────────────

export type APIKeyStatusItem = Schemas['APIKeyStatusItem'];

export type APIKeyStatusResponse = Schemas['APIKeyStatusResponse'];

export const getAPIKeyStatus = async (): Promise<APIKeyStatusResponse> => {
  const response = await apiClient.get<APIKeyStatusResponse>('/profile/api-keys');
  return response.data;
};

export const saveAPIKey = async (provider: string, api_key: string): Promise<{ provider: string; key_preview: string; message: string }> => {
  const response = await apiClient.put(`/profile/api-keys/${provider}`, { api_key });
  return response.data;
};

export const deleteAPIKey = async (provider: string): Promise<{ provider: string; message: string }> => {
  const response = await apiClient.delete(`/profile/api-keys/${provider}`);
  return response.data;
};

// ── Phase 1: Instructions ─────────────────────────────────────────────────────

export const getInstructions = async () => {
  const r = await apiClient.get('/instructions');
  return r.data;
};

export const updateInstructions = async (data: { content: string; enabled: boolean }) => {
  const r = await apiClient.put('/instructions', data);
  return r.data;
};

// ── Phase 1: User Settings ────────────────────────────────────────────────────

export const getUserSettings = async () => {
  const r = await apiClient.get('/settings');
  return r.data;
};

export const patchUserSettings = async (data: Record<string, unknown>) => {
  const r = await apiClient.patch('/settings', data);
  return r.data;
};

// ── Phase 1: Saved Queries ────────────────────────────────────────────────────

export const getSavedQueries = async (params?: {
  search?: string;
  starred?: boolean;
  limit?: number;
  offset?: number;
}) => {
  const r = await apiClient.get('/saved-queries', { params });
  return r.data;
};

export const createSavedQuery = async (data: {
  title?: string;
  nl_prompt: string;
  generated_sql: string;
  dialect?: string;
}) => {
  const r = await apiClient.post('/saved-queries', data);
  return r.data;
};

export const updateSavedQuery = async (id: number, data: { title?: string; starred?: boolean }) => {
  const r = await apiClient.patch(`/saved-queries/${id}`, data);
  return r.data;
};

export const deleteSavedQuery = async (id: number) => {
  await apiClient.delete(`/saved-queries/${id}`);
};

export const runSavedQuery = async (id: number) => {
  const r = await apiClient.post(`/saved-queries/${id}/run`);
  return r.data;
};

// ── Phase 1: Usage ────────────────────────────────────────────────────────────

export const getUsage = async (period: 'today' | '7d' | '30d' = '7d') => {
  const r = await apiClient.get('/usage', { params: { period } });
  return r.data;
};

// ── Phase 1: Data Export ──────────────────────────────────────────────────────

export const requestDataExport = async () => {
  const r = await apiClient.post('/data/export');
  return r.data;
};

export const getDataExportStatus = async (jobId: string) => {
  const r = await apiClient.get(`/data/export/${jobId}`);
  return r.data;
};

// ── Feedback ──────────────────────────────────────────────────────────────────

export const submitFeedback = async (data: {
  question: string;
  generated_sql: string;
  feedback_type: 'positive' | 'negative';
  error_type?: string;
  user_correction?: string;
  user_notes?: string;
}): Promise<{ success: boolean; message: string }> => {
  const r = await apiClient.post('/feedback', data);
  return r.data;
};

// ── Training Data ─────────────────────────────────────────────────────────────

export interface TrainingStats {
  total_records: number;
  unused_records: number;
  used_records: number;
  avg_success_score: number;
  intent_distribution: Record<string, number>;
}

export interface FineTuningJob {
  job_id: string;
  status: string;
  model: string | null;
  created_at: number | null;
  finished_at?: number | null;
  trained_tokens?: number | null;
  error?: string | null;
}

export const trainingAPI = {
  getStats: async (): Promise<TrainingStats> => {
    const r = await apiClient.get('/training/stats');
    return r.data;
  },
  exportData: async (format: 'json' | 'jsonl' = 'jsonl', limit = 1000): Promise<string> => {
    const r = await apiClient.get('/training/export', { params: { format, limit, include_used: false } });
    return r.data;
  },
  downloadData: async (format: 'json' | 'jsonl' = 'jsonl', limit = 1000): Promise<void> => {
    const token = getToken();
    const response = await fetch(
      `/api/v1/training/download?format=${format}&limit=${limit}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training_data.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  markUsed: async (ids: number[]): Promise<{ marked_count: number }> => {
    const r = await apiClient.post('/training/mark-used', ids);
    return r.data;
  },
  prepareFile: async (format: 'jsonl' = 'jsonl', limit = 1000): Promise<{ file_path: string }> => {
    const r = await apiClient.post('/fine-tuning/prepare', null, { params: { format, limit } });
    return r.data;
  },
  startJob: async (model: string, trainingFilePath: string): Promise<{ job_id: string; status: string }> => {
    const r = await apiClient.post('/fine-tuning/start', null, { params: { model, training_file_path: trainingFilePath } });
    return r.data;
  },
  getJobStatus: async (jobId: string): Promise<FineTuningJob> => {
    const r = await apiClient.get(`/fine-tuning/status/${jobId}`);
    return r.data;
  },
  listJobs: async (limit = 10): Promise<FineTuningJob[]> => {
    const r = await apiClient.get('/fine-tuning/jobs', { params: { limit } });
    return r.data;
  },
  deployModel: async (modelId: string): Promise<{ deployed: boolean; active_model: string }> => {
    const r = await apiClient.post('/fine-tuning/deploy', null, { params: { model_id: modelId } });
    return r.data;
  },
};

// ── Phase 1: Account ──────────────────────────────────────────────────────────

export const getRetention = async () => {
  const r = await apiClient.get('/account/retention');
  return r.data;
};

export const updateRetention = async (data_retention: string) => {
  const r = await apiClient.put('/account/retention', { data_retention });
  return r.data;
};

export const requestAccountDeletion = async (confirm: string) => {
  const r = await apiClient.post('/account/delete', { confirm });
  return r.data;
};

export const cancelAccountDeletion = async () => {
  const r = await apiClient.post('/account/delete/cancel');
  return r.data;
};

// ── Phase 1: Auth Sessions ────────────────────────────────────────────────────

export const getAuthSessions = async () => {
  const r = await apiClient.get('/auth-sessions');
  return r.data;
};

export const revokeAuthSession = async (id: string) => {
  await apiClient.delete(`/auth-sessions/${id}`);
};

export const revokeAllAuthSessions = async () => {
  const r = await apiClient.delete('/auth-sessions');
  return r.data;
};

export const getLoginActivity = async (limit = 20) => {
  const r = await apiClient.get('/login-activity', { params: { limit } });
  return r.data;
};

// ── Phase 1: History v2 ───────────────────────────────────────────────────────

export const exportHistoryFile = async (format: 'csv' | 'json'): Promise<Blob> => {
  const r = await apiClient.get('/history/export', {
    params: { format },
    responseType: 'blob',
  });
  return r.data;
};

export const clearAllHistory = async (confirm: string) => {
  const r = await apiClient.post('/history/clear', { confirm });
  return r.data;
};

// ── Phase 2: Query Templates ──────────────────────────────────────────────────

export type TemplateParameter = Schemas['TemplateParameter'];

export type QueryTemplate = Schemas['QueryTemplateOut'];

export const getTemplates = async (params?: { search?: string; limit?: number; offset?: number }) => {
  const r = await apiClient.get('/query-templates', { params });
  return r.data as { items: QueryTemplate[]; total: number };
};

export const createTemplate = async (d: {
  name: string;
  description?: string;
  template_nl: string;
  template_sql: string;
  parameters?: TemplateParameter[];
  tags?: string[];
}) => {
  const r = await apiClient.post('/query-templates', d);
  return r.data as QueryTemplate;
};

export const updateTemplate = async (
  id: number,
  d: Partial<{ name: string; description: string; template_nl: string; template_sql: string; parameters: TemplateParameter[]; tags: string[] }>,
) => {
  const r = await apiClient.patch(`/query-templates/${id}`, d);
  return r.data as QueryTemplate;
};

export const deleteTemplate = async (id: number) => {
  await apiClient.delete(`/query-templates/${id}`);
};

export const renderTemplate = async (id: number, values: Record<string, string>) => {
  const r = await apiClient.post(`/query-templates/${id}/render`, { values });
  return r.data as { nl: string; sql: string; missing_params: string[] };
};

// ── Phase 2: Favorited Tables ─────────────────────────────────────────────────

export type FavoritedTable = Schemas['FavoritedTableOut'];

export const getFavoritedTables = async () => {
  const r = await apiClient.get('/favorited-tables');
  return r.data as FavoritedTable[];
};

export const pinTable = async (d: { table_name: string; schema_name?: string; note?: string }) => {
  const r = await apiClient.post('/favorited-tables', d);
  return r.data as FavoritedTable;
};

export const updatePinnedTable = async (id: number, note: string | null) => {
  const r = await apiClient.patch(`/favorited-tables/${id}`, { note });
  return r.data as FavoritedTable;
};

export const unpinTable = async (id: number) => {
  await apiClient.delete(`/favorited-tables/${id}`);
};

// ── Phase 2: Glossary ─────────────────────────────────────────────────────────

export type GlossaryEntry = Schemas['GlossaryEntryOut'];

export const getGlossary = async (search?: string) => {
  const r = await apiClient.get('/glossary', { params: { search, limit: 50 } });
  return r.data as { items: GlossaryEntry[]; total: number };
};

export const createGlossaryEntry = async (d: { term: string; definition: string }) => {
  const r = await apiClient.post('/glossary', d);
  return r.data as GlossaryEntry;
};

export const updateGlossaryEntry = async (id: number, d: { term?: string; definition?: string }) => {
  const r = await apiClient.patch(`/glossary/${id}`, d);
  return r.data as GlossaryEntry;
};

export const deleteGlossaryEntry = async (id: number) => {
  await apiClient.delete(`/glossary/${id}`);
};

// ── Phase 2: Notifications ────────────────────────────────────────────────────

export type NotificationPrefs = Schemas['NotificationPrefsOut'];

export const getNotificationPrefs = async () => {
  const r = await apiClient.get('/notifications/preferences');
  return r.data as NotificationPrefs;
};

export const updateNotificationPrefs = async (d: Partial<NotificationPrefs>) => {
  const r = await apiClient.patch('/notifications/preferences', d);
  return r.data as NotificationPrefs;
};

// ── Phase 2: Change Password ──────────────────────────────────────────────────

export const changePassword = async (current_password: string, new_password: string) => {
  const r = await apiClient.post('/auth/change-password', { current_password, new_password });
  return r.data as { message: string };
};

// ── Phase 2: Tutorial & Onboarding ───────────────────────────────────────────

export type TutorialProgress = Schemas['TutorialProgressOut'];

export const getTutorialProgress = async () => {
  const r = await apiClient.get('/tutorial');
  return r.data as TutorialProgress;
};

export const patchTutorialProgress = async (d: { completed_steps?: string[]; dismissed?: boolean }) => {
  const r = await apiClient.patch('/tutorial', d);
  return r.data as TutorialProgress;
};

export type OnboardingState = Schemas['OnboardingOut'];

export const getOnboarding = async () => {
  const r = await apiClient.get('/onboarding');
  return r.data as OnboardingState;
};

export const patchOnboarding = async (completed_items: string[]) => {
  const r = await apiClient.patch('/onboarding', { completed_items });
  return r.data as OnboardingState;
};

export default apiClient;
