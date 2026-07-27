/**
 * useChat hook — manages chat state, session creation, and query submission.
 *
 * Encapsulates all data-fetching and state logic so that components
 * remain pure presentational layers.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  streamQuery,
  createSession,
  getSession,
  type SessionDetail,
  executeSQL,
  addSessionMessage,
  type AddMessageRequest,
} from '../api/client';
import type { ChatMessage } from '../types/query.types';
import { guessChartConfig as guessChartConfigImpl } from '../utils/chart';

/** A single step in the live "thinking" trace. */
export interface ThinkingStep {
  stage: string;
  label: string;
  detail?: string;
}

/** Streamed pipeline stages → human-readable labels (in order of appearance). */
const STAGE_LABELS: Record<string, string> = {
  initializing: 'Warming up',
  retrieving_schema: 'Retrieving relevant schema',
  schema_retrieved: 'Grounding on tables',
  generating_sql: 'Generating SQL',
  sql_generated: 'Drafting query',
  validating_sql: 'Validating query',
  executing_sql: 'Executing against database',
};

interface UseChatReturn {
  currentSession: SessionDetail | null;
  messages: ChatMessage[];
  question: string;
  setQuestion: (q: string) => void;
  pendingQuestion: string | null;
  loadingText: string | null;
  thinkingSteps: ThinkingStep[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  validationError: string | null;
  rateLimitError: {
    message: string;
    retryAfter: number;
    lastQuestion: string;
    lastExecute: boolean;
  } | null;
  sendMessage: (dialect: string, execute: boolean) => Promise<void>;
  sendCorrection: (dialect: string, execute: boolean, correctionText: string) => Promise<void>;
  abortQuery: () => void;
  addDirectSqlMessage: (sql: string, nlPrompt: string) => Promise<void>;
  handleNewChat: () => Promise<void>;
  handleRetry: (dialect: string) => void;
  editMessage: (messageId: number, newText: string, dialect: string, execute: boolean) => Promise<void>;
  regenerateMessage: (messageId: number, dialect: string, execute: boolean) => Promise<void>;
  clearValidationError: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function useChat(): UseChatReturn {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [question, setQuestion] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionDetail | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [rateLimitError, setRateLimitError] = useState<{
    message: string;
    retryAfter: number;
    lastQuestion: string;
    lastExecute: boolean;
  } | null>(null);
  const [ownIsError, setOwnIsError] = useState(false);
  const [ownError, setOwnError] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const abortedRef = useRef(false);

  // Cancel any in-flight SSE stream on unmount
  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  // Refs to avoid stale closures
  const currentSessionRef = useRef(currentSession);
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  const pushStep = (stage: string, detail?: string) => {
    const label = STAGE_LABELS[stage];
    if (!label) return;
    setLoadingText(label);
    setThinkingSteps((prev) => {
      if (prev.some((s) => s.stage === stage)) {
        return prev.map((s) => (s.stage === stage && detail ? { ...s, detail } : s));
      }
      return [...prev, { stage, label, detail }];
    });
  };

  const queryMutation = useMutation({
    mutationFn: async (vars: any) => {
      // Abort any previous in-flight stream before starting a new one
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let finalData: any = null;

      await streamQuery(vars, (chunk) => {
        if (chunk.status === 'error') {
          const err = new Error(chunk.error || 'Unknown error');
          (err as any).type = chunk.type;
          throw err;
        }
        if (chunk.stage) {
          const detail =
            chunk.stage === 'schema_retrieved' && Array.isArray(chunk.tables)
              ? `${chunk.tables.length} table${chunk.tables.length !== 1 ? 's' : ''}`
              : undefined;
          pushStep(chunk.stage, detail);
        }
        if (chunk.status === 'complete' && chunk.data) {
          finalData = chunk.data;
        }
      }, controller.signal);

      abortControllerRef.current = null;
      if (!finalData) throw new Error('Stream ended without complete data');
      return finalData;
    },
    onMutate: () => {
      abortedRef.current = false;
      setOwnIsError(false);
      setOwnError(null);
      setLoadingText('Warming up');
      setThinkingSteps([{ stage: 'initializing', label: STAGE_LABELS.initializing }]);
    },
    onSuccess: async (data) => {
      setPendingQuestion(null);
      setOwnIsError(false);
      setOwnError(null);
      setRateLimitError(null);
      setLoadingText(null);
      setThinkingSteps([]);
      const sessionId = currentSessionRef.current?.id;
      if (sessionId) {
        // Manually add the message immediately to avoid DB commit race condition
        const newMessage = {
          id: Date.now(),
          question: data.question,
          timestamp: new Date().toISOString(),
          response: data,
        };
        setCurrentSession((prev) =>
          prev ? { ...prev, messages: [...prev.messages, newMessage] } : null,
        );

        // Invalidate sidebar sessions list
        queryClient.invalidateQueries({ queryKey: ['sessions', 'recent'] });

        // Background sync to ensure we get the real IDs eventually
        setTimeout(() => {
          getSession(sessionId).then((updatedSession) => {
            setCurrentSession((prev) => {
              if (prev && prev.messages.length === updatedSession.messages.length) {
                return updatedSession;
              }
              return prev;
            });
          }).catch(() => {});
        }, 300); // let DB commit persist real message IDs
      }
    },
    onError: (error: any) => {
      setLoadingText(null);
      setThinkingSteps([]);
      setPendingQuestion(null);

      const wasAborted = abortedRef.current || error?.name === 'AbortError';
      abortedRef.current = false;
      if (wasAborted) return;

      setOwnIsError(true);
      setOwnError(error);

      const isRateLimit =
        error?.type === 'RateLimitError' ||
        error?.message?.includes('Rate limit') ||
        error?.response?.status === 429;

      if (isRateLimit) {
        const errorData = error.response?.data;
        const retryMatch = error.message?.match(/try again in (\d+) seconds/i);
        const retryAfter = errorData?.retry_after || (retryMatch ? parseInt(retryMatch[1], 10) : 30);

        setRateLimitError({
          message: error.message || errorData?.message || 'Rate limit exceeded. Please try again.',
          retryAfter: retryAfter,
          lastQuestion: question.trim(),
          lastExecute: false,
        });
      } else {
        setRateLimitError(null);
        setValidationError(error.message || 'An unexpected error occurred while generating SQL.');
      }
    },
  });

  const getOrCreateSession = useCallback(async (): Promise<string> => {
    if (!currentSession) {
      const session = await createSession();
      const newSession = {
        id: session.id,
        title: session.title,
        created_at: session.created_at,
        updated_at: session.updated_at,
        messages: [],
      };
      setCurrentSession(newSession);
      return session.id;
    }
    return currentSession.id;
  }, [currentSession]);

  // Shared submission path for both plain questions and corrections. A
  // correction is sent through the same query flow with `is_correction: true`
  // so the backend rewrites the previous turn and regenerates SQL.
  const submitQuery = useCallback(
    async (text: string, dialect: string, execute: boolean, isCorrection: boolean) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (trimmed.length < 3) {
        setValidationError('Question must be at least 3 characters long.');
        return;
      }
      if (trimmed.length > 2000) {
        setValidationError('Question too long (max 2000 characters).');
        return;
      }
      setValidationError(null);
      setRateLimitError(null);

      // Optimistically show the message and clear the input immediately
      setPendingQuestion(trimmed);
      setQuestion('');

      let sessionId: string;
      try {
        sessionId = await getOrCreateSession();
      } catch {
        setPendingQuestion(null);
        setQuestion(trimmed);
        setValidationError('Failed to create chat session. Please try again.');
        return;
      }

      queryMutation.mutate({
        question: trimmed,
        dialect,
        execute,
        session_id: sessionId || undefined,
        ...(isCorrection ? { is_correction: true } : {}),
      });
    },
    [getOrCreateSession, queryMutation],
  );

  const sendMessage = useCallback(
    (dialect: string, execute: boolean) => submitQuery(question, dialect, execute, false),
    [question, submitQuery],
  );

  const sendCorrection = useCallback(
    (dialect: string, execute: boolean, correctionText: string) =>
      submitQuery(correctionText, dialect, execute, true),
    [submitQuery],
  );

  // Re-run the same earlier question to get a fresh generation (Regenerate /
  // Retry). Reuses the shared submit/stream flow — the new turn continues the
  // conversation so multi-turn context is preserved.
  const regenerateMessage = useCallback(
    (messageId: number, dialect: string, execute: boolean) => {
      const msg = currentSessionRef.current?.messages.find((m) => m.id === messageId);
      if (!msg) return Promise.resolve();
      return submitQuery(msg.question, dialect, execute, false);
    },
    [submitQuery],
  );

  // Re-submit an edited version of an earlier question (continues the thread).
  const editMessage = useCallback(
    (_messageId: number, newText: string, dialect: string, execute: boolean) =>
      submitQuery(newText, dialect, execute, false),
    [submitQuery],
  );

  const abortQuery = useCallback(() => {
    if (abortControllerRef.current) {
      abortedRef.current = true;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setPendingQuestion(null);
    setLoadingText(null);
    setThinkingSteps([]);
  }, []);

  const handleNewChat = useCallback(async () => {
    try {
      if (currentSessionRef.current && currentSessionRef.current.messages.length === 0) {
        setQuestion('');
        setValidationError(null);
        return;
      }
      // Clear the current session state to start a new chat.
      // The backend session is created when the first message is sent.
      setCurrentSession(null);
      setQuestion('');
      setValidationError(null);
    } catch {
      // silently fail
    }
  }, []);

  const handleRetry = useCallback(
    (dialect: string) => {
      if (!rateLimitError) return;
      setRateLimitError(null);
      queryMutation.mutate({
        question: rateLimitError.lastQuestion,
        dialect,
        execute: rateLimitError.lastExecute,
        session_id: currentSession?.id || undefined,
      });
    },
    [rateLimitError, currentSession, queryMutation],
  );

  // Load session from navigation state (recent chats / History "Continue Chat")
  useEffect(() => {
    const state = location.state as { loadSessionId?: string; sessionId?: string; newChat?: boolean };
    if (state?.newChat) {
      handleNewChat();
      window.history.replaceState({}, document.title);
    } else if (state?.loadSessionId || state?.sessionId) {
      const sessionIdToLoad = state.loadSessionId || state.sessionId;
      if (sessionIdToLoad) {
        getSession(sessionIdToLoad)
          .then((session) => {
            setCurrentSession(session);
            setValidationError(null);
          })
          .catch(() => setValidationError('Failed to load chat session.'));
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state, handleNewChat]);

  // Auto-scroll on new messages or optimistic bubble
  useEffect(() => {
    if (pendingQuestion || (currentSession?.messages && currentSession.messages.length > 0)) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentSession?.messages, pendingQuestion]);

  // Thin wrapper over the extracted, unit-tested pure helper.
  const guessChartConfig = (data: any[] | null) => guessChartConfigImpl(data);

  const addDirectSqlMessage = async (sql: string, nlPrompt: string) => {
    setValidationError(null);
    setLoadingText('Executing SQL...');
    
    let sessionId: string;
    try {
      sessionId = await getOrCreateSession();
    } catch (err) {
      setValidationError('Failed to create chat session.');
      setLoadingText(null);
      return;
    }

    try {
      const execResult = await executeSQL({ sql });
      const suggestedChart = guessChartConfig(execResult.results ?? null);

      const addMsgReq: AddMessageRequest = {
        question: `Visual Query: ${nlPrompt}`,
        sql: sql,
        dialect: 'postgresql',
        is_valid: execResult.success,
        validation_errors: execResult.error ? [execResult.error] : [],
        execution_result: execResult.results,
        execution_error: execResult.error,
        intent_type: 'direct_sql',
        tokens_used: 0,
        cached: false,
        suggested_chart: suggestedChart as AddMessageRequest['suggested_chart'],
      };

      const savedMsg = await addSessionMessage(sessionId, addMsgReq);

      setCurrentSession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, savedMsg],
        };
      });
    } catch (err) {
      console.error('Direct SQL execution error:', err);
      setValidationError('Direct SQL execution failed.');
    } finally {
      setLoadingText(null);
    }
  };

  return {
    currentSession,
    messages: currentSession?.messages || [],
    question,
    setQuestion,
    pendingQuestion,
    loadingText,
    thinkingSteps,
    isLoading: queryMutation.isPending || !!loadingText,
    isError: ownIsError,
    error: ownError,
    validationError,
    rateLimitError,
    sendMessage,
    sendCorrection,
    abortQuery,
    addDirectSqlMessage,
    handleNewChat,
    handleRetry,
    editMessage,
    regenerateMessage,
    clearValidationError: () => setValidationError(null),
    messagesEndRef,
  };
}
