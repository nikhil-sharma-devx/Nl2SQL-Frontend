/**
 * ConnectionsManager — CRUD UI for the user's database connections.
 *
 * Lives on the Schema page (replaces the single-connection card). Lets the user
 * add, rename, test, delete, and switch the active connection. The active
 * connection is server-resolved; switching here immediately re-scopes the
 * schema, graph, chat and RAG (ConnectionContext invalidates the dependent
 * queries).
 */
import { useState } from 'react';
import { Database, Link2, Loader2, Plus, Check, Trash2, Pencil, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useConnections } from '../../context/ConnectionContext';
import { handleApiError, type Connection } from '../../api/client';
import { toast } from '../../components/ui/toast';

function ConnectionRow({ conn }: { conn: Connection }) {
  const { activeConnectionId, update, remove, test, select } = useConnections();
  const isActive = conn.connection_id === activeConnectionId;

  const [busy, setBusy] = useState<null | 'select' | 'test' | 'delete' | 'save'>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(conn.name);
  const [newUrl, setNewUrl] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'select' | 'test' | 'delete' | 'save', fn: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(handleApiError(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const handleSelect = () => run('select', () => select(conn.connection_id));

  const handleTest = async () => {
    const ok = await run('test', async () => {
      const res = await test(conn.connection_id);
      if (!res.ok) throw new Error(res.message);
      return res;
    });
    if (ok) toast({ title: `“${conn.name}” is reachable`, variant: 'success' });
  };

  const handleDelete = () =>
    run('delete', async () => {
      await remove(conn.connection_id);
      toast({ title: `Deleted “${conn.name}”`, variant: 'success' });
    });

  const handleSave = async () => {
    const ok = await run('save', () =>
      update(conn.connection_id, {
        name: name.trim() !== conn.name ? name.trim() : undefined,
        database_url: newUrl.trim() ? newUrl.trim() : undefined,
      }),
    );
    if (ok) {
      setEditing(false);
      setNewUrl('');
      toast({ title: 'Connection updated', variant: 'success' });
    }
  };

  return (
    <div
      className={
        'rounded-xl border p-4 transition-colors ' +
        (isActive ? 'border-primary/40 bg-primary/[0.04]' : 'border-border bg-foreground/[0.02]')
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Database className={'mt-0.5 h-5 w-5 shrink-0 ' + (isActive ? 'text-primary' : 'text-muted-foreground/80')} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold text-foreground">{conn.name}</span>
              <Badge variant="secondary" className="uppercase">{conn.db_type}</Badge>
              {isActive && <Badge variant="default">Active</Badge>}
              {!conn.has_dsn && <Badge variant="outline">Server default</Badge>}
            </div>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground/80">
              {conn.url_preview ?? 'Uses the platform database'}
            </p>
          </div>
        </div>
        {!editing && (
          <div className="flex shrink-0 items-center gap-1.5">
            {!isActive && (
              <Button size="sm" variant="outline" onClick={handleSelect} disabled={busy !== null}>
                {busy === 'select' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span className="ml-1">Use</span>
              </Button>
            )}
            {conn.has_dsn && (
              <Button size="sm" variant="ghost" onClick={handleTest} disabled={busy !== null} title="Test connection">
                {busy === 'test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={busy !== null} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              disabled={busy !== null}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div>
            <Label htmlFor={`name-${conn.connection_id}`} className="text-xs">Name</Label>
            <Input id={`name-${conn.connection_id}`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`url-${conn.connection_id}`} className="text-xs">
              New connection string (leave blank to keep current)
            </Label>
            <Input
              id={`url-${conn.connection_id}`}
              type="password"
              placeholder="postgresql://user:password@host:5432/db"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={busy !== null}>
              {busy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              <span className={busy === 'save' ? 'ml-1' : ''}>Save</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setName(conn.name);
                setNewUrl('');
                setError(null);
              }}
              disabled={busy !== null}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-destructive/10 p-3">
          <span className="text-sm text-rose-200">Delete “{conn.name}”? Its schema index is removed too.</span>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                const ok = await handleDelete();
                if (ok) setConfirmDelete(false);
              }}
              disabled={busy !== null}
            >
              {busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Delete'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function AddConnectionForm() {
  const { create } = useConnections();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setUrl('');
    setError(null);
    setOpen(false);
  };

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await create({ name: name.trim(), database_url: url.trim() });
      toast({ title: `Added “${name.trim()}”`, variant: 'success' });
      reset();
    } catch (e) {
      setError(handleApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        <span className="ml-1.5">Add connection</span>
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-foreground/[0.02] p-4">
      <div>
        <Label htmlFor="new-conn-name" className="text-xs">Display name</Label>
        <Input
          id="new-conn-name"
          placeholder="Production"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="new-conn-url" className="text-xs">Connection string</Label>
        <Input
          id="new-conn-url"
          type="password"
          placeholder="postgresql://user:password@host:5432/db"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Validated and connection-tested before it's saved. Stored encrypted at rest.
        </p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Button onClick={handleAdd} disabled={submitting || !name.trim() || !url.trim()}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span className="ml-1.5">{submitting ? 'Validating & saving…' : 'Add connection'}</span>
        </Button>
        <Button variant="ghost" onClick={reset} disabled={submitting}>Cancel</Button>
      </div>
    </div>
  );
}

export default function ConnectionsManager() {
  const { connections, isLoading, error } = useConnections();

  return (
    <Card id="db-connection-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <Link2 className="h-5 w-5 text-violet-400" />
          Database Connections
        </CardTitle>
        <CardDescription>
          Connect multiple databases and switch between them at any time. The active connection is
          used for the schema, chat, SQL preview and query execution.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading connections…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{handleApiError(error)}</p>
        ) : (
          <>
            <div className="space-y-3">
              {connections.map((conn) => (
                <ConnectionRow key={conn.connection_id} conn={conn} />
              ))}
            </div>
            <AddConnectionForm />
          </>
        )}
      </CardContent>
    </Card>
  );
}
