/**
 * useSchema hook — fetches and caches schema status from the backend.
 */
import { useQuery } from '@tanstack/react-query';
import { getSchemaStatus } from '../api/client';
import type { SchemaStatusResponse } from '../types/schema.types';

interface UseSchemaReturn {
  /** Schema status data */
  schemaStatus: SchemaStatusResponse | undefined;
  /** Whether the schema is loading */
  isLoading: boolean;
  /** Error object */
  error: unknown;
  /** Re-fetch the schema status */
  refetch: () => void;
}

export function useSchema(): UseSchemaReturn {
  const { data, isLoading, error, refetch } = useQuery<SchemaStatusResponse>({
    queryKey: ['schemaStatus'],
    queryFn: getSchemaStatus,
    staleTime: 30_000, // Cache for 30 seconds
  });

  return {
    schemaStatus: data,
    isLoading,
    error,
    refetch,
  };
}
