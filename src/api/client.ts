import axios, { AxiosError } from 'axios';

// Query types
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
  suggested_chart?: {
    type: string;
    x_axis: string;
    y_axis: string;
  } | null;
  follow_up_questions?: string[];
  intent_type?: string | null;
}

export interface ExplainResponse {
  sql: string;
  explanation: string;
}

export interface SuggestionRequest {
  original_question: string;
  generated_sql: string;
  retrieved_tables: string[];
}

export interface SuggestionResponse {
  suggestions: string[];
}

export interface ExecuteRequest {
  sql: string;
  dialect?: string;
}

export interface ExecuteResponse {
  sql: string;
  success: boolean;
  results: Record<string, unknown>[] | null;
  error: string | null;
  row_count: number;
}

// Schema types
export interface IngestResponse {
  message: string;
  chunks_ingested: number;
}

export interface SchemaStatusResponse {
  chunks_stored: number;
  vector_store_ready: boolean;
}

export interface SchemaRefreshResponse {
  message: string;
  tables_found: number;
  chunks_ingested: number;
}

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

// History types
export interface HistoryEntry {
  id: number;
  timestamp: string;
  query_response: QueryResponse;
}

export interface HistoryListResponse {
  entries: HistoryEntry[];
  total: number;
}

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

export interface SessionListResponse {
  sessions: ChatSession[];
  total: number;
}

// In production (Vercel) VITE_API_BASE_URL points to the AWS backend,
// e.g. https://api.yourdomain.com — leave empty for local dev (proxy handles it).
const _base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
export const API_ORIGIN = _base;

// Create axios instance
const apiClient = axios.create({
  baseURL: `${_base}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token from localStorage to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('nl2sql_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

/**
 * When the server rejects our token (401), the stored session is stale or
 * expired. Clear it and send the user back to the login screen so a fresh,
 * valid token can be minted — rather than surfacing a confusing error.
 */
export const forceReauth = (): void => {
  try {
    localStorage.removeItem('nl2sql_token');
    localStorage.removeItem('nl2sql_user');
  } catch {
    // ignore storage errors
  }
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
    window.location.assign('/auth');
  }
};

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      forceReauth();
    }
    return Promise.reject(error);
  },
);

// Error handler helper
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: any; message?: string }>;
    if (axiosError.response?.data) {
      const data = axiosError.response.data;

      // FastAPI ValidationError returns detail as an array of objects
      if (Array.isArray(data.detail)) {
        return data.detail.map((err: any) => err.msg || JSON.stringify(err)).join(', ');
      }

      if (typeof data.detail === 'string') {
        return data.detail;
      }

      return data.message || `Error: ${axiosError.response.status}`;
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
  const token = localStorage.getItem('nl2sql_token');
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${_base}/api/v1/query/stream`, {
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

export interface AddMessageRequest {
  question: string;
  sql: string;
  dialect: string;
  is_valid: boolean;
  validation_errors?: string[];
  retrieved_tables?: string[];
  used_tables?: string[];
  execution_result?: Record<string, unknown>[] | null;
  execution_error?: string | null;
  tokens_used?: number;
  cached?: boolean;
  message?: string | null;
  intent_type?: string | null;
  suggested_chart?: {
    type: string;
    x_axis: string;
    y_axis: string;
  } | null;
  follow_up_questions?: string[];
}

export const addSessionMessage = async (sessionId: string, req: AddMessageRequest): Promise<any> => {
  const response = await apiClient.post(`/sessions/${sessionId}/messages`, req);
  return response.data;
};

// SQL Version Management functions
export interface SaveVersionRequest {
  message_id: number;
  sql: string;
  results?: Record<string, any>[];
  success: boolean;
}

export interface SaveVersionResponse {
  success: boolean;
  version_number: number;
  total_versions: number;
}

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
};

// ── Profile / BYOK API ────────────────────────────────────────────────────────

export interface APIKeyStatusItem {
  provider: string;
  label: string;
  has_user_key: boolean;
  has_server_key: boolean;
  key_preview: string | null;
  available_models: string[];
}

export interface APIKeyStatusResponse {
  keys: APIKeyStatusItem[];
  active_provider: string;
  active_model: string;
}

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
    const token = localStorage.getItem('nl2sql_token');
    const response = await fetch(
      `${_base}/api/v1/training/download?format=${format}&limit=${limit}`,
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

export default apiClient;
