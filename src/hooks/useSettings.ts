import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

export interface UserSettings {
  sql_keyword_case: 'upper' | 'lower';
  sql_cte_pref: 'cte' | 'subquery';
  sql_alias_style: 'as' | 'implicit';
  sql_indent: number;
  default_dialect: string | null;
  max_result_rows: number;
  auto_execute: boolean;
  default_model: string | null;
  data_retention: 'forever' | '30d' | '7d' | 'none';
}

const DEFAULT_SETTINGS: UserSettings = {
  sql_keyword_case: 'upper',
  sql_cte_pref: 'cte',
  sql_alias_style: 'as',
  sql_indent: 2,
  default_dialect: null,
  max_result_rows: 1000,
  auto_execute: false,
  default_model: null,
  data_retention: 'forever',
};

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery<UserSettings>({
    queryKey: ['settings'],
    queryFn: () => apiClient.get('/settings').then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: (updates: Partial<UserSettings>) =>
      apiClient.patch('/settings', updates).then(r => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
    },
  });

  return {
    settings: settings ?? DEFAULT_SETTINGS,
    isLoading,
    error,
    updateSettings: mutation.mutateAsync,
    isSaving: mutation.isPending,
    saveError: mutation.error,
  };
}
