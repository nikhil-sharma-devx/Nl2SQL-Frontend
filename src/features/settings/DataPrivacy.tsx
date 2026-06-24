import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import ConfirmDestructive from '../../components/ConfirmDestructive';

type Retention = 'forever' | '30d' | '7d' | 'none';

const RETENTION_OPTIONS: { value: Retention; label: string }[] = [
  { value: 'forever', label: 'Forever' },
  { value: '30d', label: '30 days' },
  { value: '7d', label: '7 days' },
  { value: 'none', label: "Don't store" },
];

export default function DataPrivacySettings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [retentionError, setRetentionError] = useState<string | null>(null);

  const { data: retentionData } = useQuery({
    queryKey: ['retention'],
    queryFn: () => apiClient.get('/account/retention').then(r => r.data),
  });

  const { data: exportStatus } = useQuery({
    queryKey: ['export-job', exportJobId],
    queryFn: () => apiClient.get(`/data/export/${exportJobId}`).then(r => r.data),
    enabled: !!exportJobId,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === 'queued' || status === 'running' ? 2000 : false;
    },
  });

  const retentionMutation = useMutation({
    mutationFn: (data_retention: string) =>
      apiClient.put('/account/retention', { data_retention }).then(r => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['retention'], data);
      setRetentionError(null);
    },
    onError: () => {
      setRetentionError('Failed to update retention setting.');
    },
  });

  const clearMutation = useMutation({
    mutationFn: (confirm: string) =>
      apiClient.post('/history/clear', { confirm }).then(r => r.data),
    onSuccess: (d) => {
      setClearOpen(false);
      setClearError(null);
      setClearResult(`${d.soft_deleted} message${d.soft_deleted !== 1 ? 's' : ''} cleared.`);
    },
    onError: () => {
      setClearOpen(false);
      setClearError('Failed to clear history. Please try again.');
    },
  });

  const exportRequestMutation = useMutation({
    mutationFn: () => apiClient.post('/data/export').then(r => r.data),
    onSuccess: (d) => {
      setExportJobId(d.job_id);
      setExportError(null);
    },
    onError: () => {
      setExportError('Failed to request data export. Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (confirm: string) =>
      apiClient.post('/account/delete', { confirm }).then(r => r.data),
    onSuccess: async () => {
      setDeleteOpen(false);
      setDeleteError(null);
      await logout();
      navigate('/auth');
    },
    onError: () => {
      setDeleteOpen(false);
      setDeleteError('Failed to schedule account deletion. Please try again.');
    },
  });

  const handleHistoryExport = (format: 'csv' | 'json') => {
    apiClient
      .get('/history/export', { params: { format }, responseType: 'blob' })
      .then(r => {
        const url = URL.createObjectURL(r.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `history.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="space-y-6 max-w-lg">
      {/* Export History */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Export History</h3>
        <p className="text-xs text-muted-foreground">Download your query history as a file.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleHistoryExport('csv')}>
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleHistoryExport('json')}>
            Export JSON
          </Button>
        </div>
      </section>

      <Separator />

      {/* Clear History */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Clear History</h3>
        <p className="text-xs text-muted-foreground">
          Soft-deletes all query history. Data is recoverable within 30 days.
        </p>
        {clearResult && <p className="text-xs text-primary">{clearResult}</p>}
        {clearError && <p className="text-xs text-destructive">{clearError}</p>}
        <Button variant="outline" size="sm" onClick={() => { setClearError(null); setClearResult(null); setClearOpen(true); }}>
          Clear All History
        </Button>
        <ConfirmDestructive
          open={clearOpen}
          onClose={() => setClearOpen(false)}
          onConfirm={() => clearMutation.mutateAsync(user?.email ?? '').catch(() => {})}
          title="Clear All History"
          description="This will soft-delete all your query history. Type your email to confirm."
          confirmText={user?.email ?? ''}
          isLoading={clearMutation.isPending}
          destructiveLabel="Clear History"
        />
      </section>

      <Separator />

      {/* Download My Data */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Download My Data</h3>
        <p className="text-xs text-muted-foreground">
          Request a ZIP of all your data (queries, settings, instructions).
        </p>
        {!exportJobId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setExportError(null); exportRequestMutation.mutate(); }}
            disabled={exportRequestMutation.isPending}
          >
            {exportRequestMutation.isPending ? 'Requesting…' : 'Request Data Export'}
          </Button>
        )}
        {exportError && <p className="text-xs text-destructive">{exportError}</p>}
        {exportStatus && (
          <p className="text-xs text-muted-foreground">
            Status: <span className="font-medium text-foreground">{exportStatus.status}</span>
            {exportStatus.status === 'done' && exportStatus.download_url && (
              <> — <button
                className="text-primary underline cursor-pointer"
                onClick={() => {
                  apiClient
                    .get(exportStatus.download_url.replace(/^\/api\/v1\//, ''), { responseType: 'blob' })
                    .then(r => {
                      const url = URL.createObjectURL(r.data);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'my_data.zip';
                      a.click();
                      URL.revokeObjectURL(url);
                    });
                }}
              >Download</button></>
            )}
            {exportStatus.status === 'failed' && exportStatus.error && (
              <span className="text-destructive"> — {exportStatus.error}</span>
            )}
          </p>
        )}
      </section>

      <Separator />

      {/* Data Retention */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Data Retention</h3>
        <p className="text-xs text-muted-foreground">
          How long to keep your query history.
        </p>
        <div className="flex flex-wrap gap-2">
          {RETENTION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => retentionMutation.mutate(opt.value)}
              disabled={retentionMutation.isPending}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                (retentionData?.data_retention ?? 'forever') === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {retentionError && <p className="text-xs text-destructive">{retentionError}</p>}
        {retentionMutation.isSuccess && <p className="text-xs text-primary">Retention setting saved.</p>}
      </section>

      <Separator />

      {/* Delete Account */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-destructive">Delete Account</h3>
        <p className="text-xs text-muted-foreground">
          Permanently deletes your account and all data after a 7-day grace period. This cannot be undone.
        </p>
        {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
        <Button variant="destructive" size="sm" onClick={() => { setDeleteError(null); setDeleteOpen(true); }}>
          Delete Account
        </Button>
        <ConfirmDestructive
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => deleteMutation.mutateAsync(user?.email ?? '').catch(() => {})}
          title="Delete Your Account"
          description="Your account will be permanently deleted after 7 days. Type your email to confirm."
          confirmText={user?.email ?? ''}
          isLoading={deleteMutation.isPending}
          destructiveLabel="Delete My Account"
        />
      </section>
    </div>
  );
}
