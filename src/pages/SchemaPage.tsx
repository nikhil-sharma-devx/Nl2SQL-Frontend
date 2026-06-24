import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileJson,
  Check,
  AlertCircle,
  Loader2,
  Database,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
  Link2,
  Pin,
  PinOff,
  Plus,
} from 'lucide-react';
import {
  uploadSchema,
  handleApiError,
  getDatabaseConfig,
  updateDatabaseConfig,
  refreshSchema,
  getFavoritedTables,
  pinTable,
  unpinTable,
  updatePinnedTable,
  type FavoritedTable,
  type IngestResponse,
  type DatabaseConfig,
  type SchemaRefreshResponse,
} from '../api/client';
import { useSchema } from '../hooks/useSchema';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ── Pinned Tables Section ─────────────────────────────────────────────────────

function PinnedTablesSection() {
  const queryClient = useQueryClient();
  const [tableName, setTableName] = useState('');
  const [schemaName, setSchemaName] = useState('');
  const [note, setNote] = useState('');
  const [addError, setAddError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNote, setEditNote] = useState('');

  const { data: tables, isLoading } = useQuery<FavoritedTable[]>({
    queryKey: ['favorited-tables'],
    queryFn: getFavoritedTables,
  });

  const pinMutation = useMutation({
    mutationFn: () => pinTable({
      table_name: tableName.trim(),
      schema_name: schemaName.trim() || undefined,
      note: note.trim() || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorited-tables'] });
      setTableName(''); setSchemaName(''); setNote(''); setAddError('');
    },
    onError: (err) => setAddError(handleApiError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => updatePinnedTable(id, note || null),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['favorited-tables'] }); setEditingId(null); },
  });

  const unpinMutation = useMutation({
    mutationFn: (id: number) => unpinTable(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorited-tables'] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <Pin className="h-5 w-5 text-amber-400" />
          Pinned Tables
        </CardTitle>
        <CardDescription>
          Tables pinned here are included as retrieval hints in every query, so the AI prioritises them when relevant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <div className="rounded-xl border border-border bg-background/50 p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pin a Table</p>
          <div className="flex gap-2">
            <Input
              placeholder="Table name *"
              value={tableName}
              onChange={e => setTableName(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Schema (optional)"
              value={schemaName}
              onChange={e => setSchemaName(e.target.value)}
              className="w-36"
            />
          </div>
          <Input
            placeholder="Note (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          {addError && <p className="text-xs text-destructive">{addError}</p>}
          <Button
            size="sm"
            onClick={() => pinMutation.mutate()}
            disabled={!tableName.trim() || pinMutation.isPending}
          >
            <Plus className="h-3.5 w-3.5" />
            {pinMutation.isPending ? 'Pinning…' : 'Pin Table'}
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-12 animate-pulse rounded-lg border border-border bg-card/40" />)}
          </div>
        ) : !tables || tables.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tables pinned yet.</p>
        ) : (
          <div className="space-y-2">
            {tables.map(t => (
              <div key={t.id} className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
                {editingId === t.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editNote}
                      onChange={e => setEditNote(e.target.value)}
                      placeholder="Note"
                      className="flex-1 h-8 text-sm"
                    />
                    <Button size="sm" className="h-8" onClick={() => updateMutation.mutate({ id: t.id, note: editNote })}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground font-mono">
                        {t.schema_name ? `${t.schema_name}.` : ''}{t.table_name}
                      </p>
                      {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingId(t.id); setEditNote(t.note ?? ''); }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors text-xs"
                        title="Edit note"
                      >
                        Edit note
                      </button>
                      <button
                        onClick={() => unpinMutation.mutate(t.id)}
                        disabled={unpinMutation.isPending}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Unpin"
                      >
                        <PinOff className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const SchemaPage = () => {
  const queryClient = useQueryClient();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resetExisting, setResetExisting] = useState(false);
  const [uploadResult, setUploadResult] = useState<IngestResponse | null>(null);

  const [dbUrl, setDbUrl] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dbSaveStatus, setDbSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [dbSaveMessage, setDbSaveMessage] = useState('');

  const [refreshResult, setRefreshResult] = useState<SchemaRefreshResponse | null>(null);

  const { schemaStatus: status, isLoading: statusLoading, refetch: refetchStatus } = useSchema();

  const { data: dbConfig, isLoading: dbConfigLoading } = useQuery<DatabaseConfig>({
    queryKey: ['databaseConfig'],
    queryFn: getDatabaseConfig,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (dbConfig?.database_url) {
      setDbUrl(dbConfig.database_url);
    }
  }, [dbConfig]);

  const uploadMutation = useMutation({
    mutationFn: ({ file, reset }: { file: File; reset: boolean }) => uploadSchema(file, reset),
    onSuccess: (data) => {
      setUploadResult(data);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['schemaStatus'] });
    },
  });

  const dbUpdateMutation = useMutation({
    mutationFn: (url: string) => updateDatabaseConfig(url),
    onSuccess: (data) => {
      setDbSaveStatus('success');
      setDbSaveMessage(data.message);
      setDbUrl(data.database_url);
      queryClient.invalidateQueries({ queryKey: ['databaseConfig'] });
      setTimeout(() => setDbSaveStatus('idle'), 5000);
    },
    onError: (error) => {
      setDbSaveStatus('error');
      setDbSaveMessage(handleApiError(error));
      setTimeout(() => setDbSaveStatus('idle'), 8000);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshSchema(),
    onSuccess: (data) => {
      setRefreshResult(data);
      queryClient.invalidateQueries({ queryKey: ['schemaStatus'] });
      refetchStatus();
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        setSelectedFile(file);
        setUploadResult(null);
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate({ file: selectedFile, reset: resetExisting });
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setUploadResult(null);
    uploadMutation.reset();
  };

  const handleDbSave = () => {
    if (!dbUrl.trim()) return;
    setDbSaveStatus('idle');
    dbUpdateMutation.mutate(dbUrl.trim());
  };

  const maskPassword = (url: string): string => {
    try {
      const parsed = new URL(url);
      if (parsed.password) {
        return url.replace(parsed.password, '••••••••');
      }
      return url;
    } catch {
      return url;
    }
  };

  const displayUrl = showPassword ? dbUrl : maskPassword(dbUrl);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Schema Management</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your database connection, upload schema files, or sync the live schema directly.
        </p>
      </div>

      {/* Database Connection */}
      <Card id="db-connection-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <Link2 className="h-5 w-5 text-violet-400" />
            Database Connection
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dbConfigLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading connection…
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                <Label htmlFor="db-url-input" className="normal-case">Connection String</Label>
                <div className="relative">
                  <Input
                    id="db-url-input"
                    type="text"
                    value={displayUrl}
                    onChange={(e) => {
                      setDbUrl(e.target.value);
                      setDbSaveStatus('idle');
                    }}
                    onFocus={() => setShowPassword(true)}
                    placeholder="postgresql+asyncpg://user:password@host:5432/dbname"
                    className="pr-11 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/80 transition-colors hover:text-violet-400"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground/80">
                  Format: <code className="rounded border border-border bg-background/70 px-1.5 py-0.5 font-mono text-foreground/85">postgresql+asyncpg://user:pass@host:port/db</code>
                </p>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Button
                  id="save-db-connection-btn"
                  onClick={handleDbSave}
                  disabled={!dbUrl.trim() || dbUpdateMutation.isPending}
                  className="border border-violet-border bg-violet-bg text-violet-text shadow-none hover:bg-violet-text/20"
                >
                  {dbUpdateMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Validating & Saving…</>
                  ) : (
                    <><Save className="h-4 w-4" /> Save Connection</>
                  )}
                </Button>
              </div>

              {dbSaveStatus === 'success' && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 p-4">
                  <Check className="h-5 w-5 text-primary" />
                  <span className="font-medium text-primary">{dbSaveMessage}</span>
                </div>
              )}
              {dbSaveStatus === 'error' && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
                  <AlertCircle className="h-5 w-5 text-rose-400" />
                  <span className="font-medium text-rose-300">{dbSaveMessage}</span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Sync Live Schema */}
      <Card id="sync-schema-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <RefreshCw className="h-5 w-5 text-primary" />
            Sync Live Schema
          </CardTitle>
          <CardDescription>
            Reflect all tables from the active database connection and update the vector store. This replaces any previously ingested schema data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            id="refresh-schema-btn"
            onClick={() => {
              setRefreshResult(null);
              refreshMutation.mutate();
            }}
            disabled={refreshMutation.isPending}
            className="border border-primary/30 bg-primary/15 from-transparent to-transparent text-primary shadow-none hover:bg-primary/25"
          >
            {refreshMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Refreshing Schema…</>
            ) : (
              <><RefreshCw className="h-4 w-4" /> Refresh Schema from Live DB</>
            )}
          </Button>

          {refreshResult && (
            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                <span className="font-medium text-primary">Schema Refreshed</span>
              </div>
              <p className="text-sm text-primary/80">{refreshResult.message}</p>
              <p className="mt-1 text-sm text-primary/80">
                Ingested <strong className="text-primary">{refreshResult.chunks_ingested}</strong> chunks
              </p>
            </div>
          )}

          {refreshMutation.isError && (
            <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-400" />
                <span className="font-medium text-rose-300">Refresh Failed</span>
              </div>
              <p className="text-sm text-rose-300/80">{handleApiError(refreshMutation.error)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schema Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <Database className="h-5 w-5 text-cyan-400" />
            Schema Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading status…
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="card-lift rounded-xl border border-border bg-background/60 p-4 cursor-default">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Chunks Stored</p>
                <p className="mt-1 font-display text-3xl font-bold text-foreground">{status?.chunks_stored || 0}</p>
              </div>
              <div className="card-lift rounded-xl border border-border bg-background/60 p-4 cursor-default">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Vector Store</p>
                <div className="mt-1 flex items-center gap-2">
                  {status?.vector_store_ready ? (
                    <><Check className="h-5 w-5 text-primary" /><span className="font-medium text-primary">Ready</span></>
                  ) : (
                    <><AlertCircle className="h-5 w-5 text-amber-400" /><span className="font-medium text-amber-400">Not Ready</span></>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Schema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <Upload className="h-5 w-5 text-blue-400" />
            Upload Schema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={cn(
              'rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300',
              dragActive
                ? 'border-blue-500 bg-blue-500/10 shadow-[inset_0_0_20px_rgba(59,130,246,0.2)]'
                : 'border-border hover:border-blue-500/50 hover:bg-foreground/[0.02]',
            )}
          >
            <input type="file" accept=".json,application/json" onChange={handleFileChange} className="hidden" id="schema-file" />
            <label htmlFor="schema-file" className="flex cursor-pointer flex-col items-center">
              <div className={cn('mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors', dragActive ? 'bg-blue-500/20 text-blue-400' : 'bg-foreground/[0.04] text-muted-foreground')}>
                <FileJson className="h-8 w-8" />
              </div>
              <p className="mb-1 font-medium text-foreground/85">{selectedFile ? selectedFile.name : 'Drop your schema JSON file here'}</p>
              <p className="text-sm text-muted-foreground/80">{selectedFile ? `${(selectedFile.size / 1024).toFixed(2)} KB` : 'or click to browse'}</p>
            </label>
          </div>

          <label htmlFor="reset-schema" className="mt-6 flex cursor-pointer select-none items-center gap-3">
            <span className="relative flex items-center">
              <input
                type="checkbox"
                id="reset-schema"
                checked={resetExisting}
                onChange={(e) => setResetExisting(e.target.checked)}
                className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-border bg-background/60 transition-colors checked:border-rose-500 checked:bg-rose-500"
              />
              <Check className="pointer-events-none absolute left-0.5 top-0.5 h-3.5 w-3.5 text-foreground opacity-0 peer-checked:opacity-100" />
            </span>
            <span className="text-sm text-muted-foreground">Reset existing schema (removes all current schema data)</span>
          </label>

          <div className="mt-6 flex items-center gap-3">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              className="border border-info-border bg-info-bg text-info-text shadow-none hover:bg-info-text/20"
            >
              {uploadMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="h-4 w-4" /> Upload Schema</>
              )}
            </Button>
            {selectedFile && (
              <Button variant="outline" onClick={handleClear} disabled={uploadMutation.isPending}>
                <Trash2 className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>

          {uploadResult && (
            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                <span className="font-medium text-primary">Upload Successful</span>
              </div>
              <p className="text-sm text-primary/80">{uploadResult.message}</p>
              <p className="mt-1 text-sm text-primary/80">
                Ingested <strong className="text-primary">{uploadResult.chunks_ingested}</strong> chunks
              </p>
            </div>
          )}

          {uploadMutation.isError && (
            <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-400" />
                <span className="font-medium text-rose-300">Upload Failed</span>
              </div>
              <p className="text-sm text-rose-300/80">{handleApiError(uploadMutation.error)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="border-violet-border">
        <CardHeader>
          <CardTitle className="text-violet-text">Schema File Format</CardTitle>
          <CardDescription>
            The schema file should be a JSON file containing your database schema definition — table names, column definitions, and relationships.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto custom-scrollbar rounded-xl border border-border bg-background/70 p-4 font-mono text-xs text-violet-text/80 shadow-inner">
{`{
  "tables": [
    {
      "name": "users",
      "columns": [
        { "name": "id", "type": "INTEGER", "primary_key": true },
        { "name": "email", "type": "VARCHAR(255)" },
        { "name": "created_at", "type": "TIMESTAMP" }
      ]
    }
  ]
}`}
          </pre>
        </CardContent>
      </Card>

      {/* Pinned Tables */}
      <PinnedTablesSection />
    </div>
  );
};

export default SchemaPage;
