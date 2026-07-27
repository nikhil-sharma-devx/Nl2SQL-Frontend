/**
 * ConnectionContext — global state for the user's database connections.
 *
 * The *active* connection is resolved server-side (the connection marked
 * `is_default`). Switching = POST /connections/{id}/select, after which the
 * schema, schema graph, chat, SQL preview and RAG all target the new database on
 * their next request — so on switch we invalidate the schema-related query keys
 * (and drop the schema-graph localStorage cache) to refetch without a refresh.
 *
 * Mirrors AuthContext's provider/hook shape. Connections are only fetched once
 * the user is authenticated.
 */
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createConnection,
  deleteConnection,
  listConnections,
  selectConnection,
  testConnection,
  updateConnection,
  type Connection,
  type ConnectionCreate,
  type ConnectionUpdate,
} from '../api/client';
import { useAuth } from './AuthContext';

// The SchemaGraph persists its rendered graph here; it must be dropped on switch
// so a different connection never shows the previous one's cached schema.
const SCHEMA_GRAPH_CACHE_KEY = 'nl2sql_schema_graph_cache';

interface ConnectionContextValue {
  connections: Connection[];
  activeConnection: Connection | null;
  activeConnectionId: string | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  create: (body: ConnectionCreate) => Promise<Connection>;
  update: (id: string, body: ConnectionUpdate) => Promise<Connection>;
  remove: (id: string) => Promise<{ message: string }>;
  test: (id: string) => Promise<{ ok: boolean; message: string }>;
  select: (id: string) => Promise<Connection>;
}

const ConnectionContext = createContext<ConnectionContextValue | undefined>(undefined);

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: connections = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Connection[]>({
    queryKey: ['connections'],
    queryFn: listConnections,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  /** Invalidate everything that depends on the active database connection. */
  const invalidateConnectionScoped = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['connections'] });
    queryClient.invalidateQueries({ queryKey: ['schema-tables'] });
    queryClient.invalidateQueries({ queryKey: ['schemaStatus'] });
    queryClient.invalidateQueries({ queryKey: ['databaseConfig'] });
    try {
      localStorage.removeItem(SCHEMA_GRAPH_CACHE_KEY);
    } catch {
      // ignore storage errors (private mode / quota)
    }
  }, [queryClient]);

  const createMut = useMutation({
    mutationFn: (body: ConnectionCreate) => createConnection(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ConnectionUpdate }) =>
      updateConnection(id, body),
    onSuccess: () => invalidateConnectionScoped(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteConnection(id),
    onSuccess: () => invalidateConnectionScoped(),
  });

  const selectMut = useMutation({
    mutationFn: (id: string) => selectConnection(id),
    onSuccess: () => invalidateConnectionScoped(),
  });

  const create = useCallback((body: ConnectionCreate) => createMut.mutateAsync(body), [createMut]);
  const update = useCallback(
    (id: string, body: ConnectionUpdate) => updateMut.mutateAsync({ id, body }),
    [updateMut],
  );
  const remove = useCallback((id: string) => deleteMut.mutateAsync(id), [deleteMut]);
  const test = useCallback((id: string) => testConnection(id), []);
  const select = useCallback((id: string) => selectMut.mutateAsync(id), [selectMut]);

  const activeConnection = useMemo(
    () => connections.find((c) => c.is_default) ?? null,
    [connections],
  );

  const value = useMemo<ConnectionContextValue>(
    () => ({
      connections,
      activeConnection,
      activeConnectionId: activeConnection?.connection_id ?? null,
      isLoading,
      error,
      refetch,
      create,
      update,
      remove,
      test,
      select,
    }),
    [connections, activeConnection, isLoading, error, refetch, create, update, remove, test, select],
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnections(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error('useConnections must be used inside <ConnectionProvider>');
  return ctx;
}
