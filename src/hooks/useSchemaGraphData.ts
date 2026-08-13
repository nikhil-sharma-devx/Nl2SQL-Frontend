import { useCallback, useEffect, useRef, useState } from 'react';
import { getVisualizeSchema, getDatabaseConfig, handleApiError } from '../api/client';

const CACHE_KEY = 'nl2sql_schema_graph_cache';

interface SchemaCache {
  dbUrl: string;
  schema: any;
}

function saveSchemaCache(dbUrl: string, schema: any) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ dbUrl, schema }));
  } catch {
    // quota exceeded or private mode — ignore silently
  }
}

function loadSchemaCache(): SchemaCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export interface UseSchemaGraphDataResult {
  schema: any;
  loading: boolean;
  error: string | null;
  staleWarning: string | null;
  refetch: () => void;
}

/**
 * Shared schema-graph data source for both the 2D (@xyflow/react) and 3D
 * (react-three-fiber) renderers, so they never drift: same fetch, same
 * timeout-retry, same localStorage stale-cache fallback. Renderers own their
 * own node/edge layout — this hook only owns `schema` + status.
 */
export function useSchemaGraphData(): UseSchemaGraphDataResult {
  const [schema, setSchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staleWarning, setStaleWarning] = useState<string | null>(null);
  const currentDbUrl = useRef<string | null>(null);

  const fetchSchema = useCallback(async (retryCount = 0) => {
    setLoading(true);
    setError(null);
    setStaleWarning(null);

    let dbUrl = '';
    try {
      const dbConfig = await getDatabaseConfig();
      dbUrl = dbConfig.database_url || '';
      currentDbUrl.current = dbUrl;
    } catch {
      // If we can't get DB config, proceed without caching logic
    }

    try {
      const fetched = await getVisualizeSchema();
      if (!fetched || !fetched.tables) {
        throw new Error('Invalid schema format received.');
      }
      if (dbUrl) saveSchemaCache(dbUrl, fetched);
      setSchema(fetched);
    } catch (err: any) {
      console.error(err);

      const isTimeout =
        err?.code === 'ECONNABORTED' || err?.message?.toLowerCase().includes('timeout');
      if (isTimeout && retryCount < 1) {
        console.log('Schema graph timed out, retrying…');
        return fetchSchema(retryCount + 1);
      }

      const cache = loadSchemaCache();
      if (cache?.schema?.tables && dbUrl && cache.dbUrl === dbUrl) {
        setSchema(cache.schema);
        setStaleWarning('Unable to load the latest schema — showing previously loaded data.');
        setError(null);
      } else {
        const msg = isTimeout
          ? 'Database is taking too long to respond. Please check your connection and try again.'
          : handleApiError(err) || 'Failed to load schema.';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  return { schema, loading, error, staleWarning, refetch: () => fetchSchema() };
}
