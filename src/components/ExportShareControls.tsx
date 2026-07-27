/**
 * ExportShareControls — Export (CSV/JSON/SQL/PDF) + Share (secure link, copy,
 * email, Slack, revoke) for a single query result.
 *
 * Rendered on the result surface (SqlPreview). All network calls go through the
 * typed client; feedback surfaces via the shared toast + handleApiError.
 */
import { useState } from 'react';
import { Download, Share2, Copy, Check, Mail, Send, Loader2, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  exportQuery,
  createShare,
  emailShare,
  slackShare,
  revokeShare,
  handleApiError,
  type ExportFormat,
  type ShareCreateResponse,
} from '../api/client';
import type { QueryResponse } from '../types/query.types';

const EXPORT_FORMATS: { fmt: ExportFormat; label: string }[] = [
  { fmt: 'csv', label: 'CSV' },
  { fmt: 'json', label: 'JSON' },
  { fmt: 'sql', label: 'SQL' },
  { fmt: 'pdf', label: 'PDF' },
];

const EXPIRY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Never' },
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
];

interface Props {
  response: QueryResponse;
}

const ExportShareControls = ({ response }: Props) => {
  const rows = (response.execution_result ?? []) as Record<string, unknown>[];

  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [expiry, setExpiry] = useState('');
  const [creating, setCreating] = useState(false);
  const [share, setShare] = useState<ShareCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingSlack, setSendingSlack] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const handleExport = async (fmt: ExportFormat) => {
    setExporting(fmt);
    try {
      await exportQuery(fmt, response.sql ?? '', response.question ?? '', rows);
      toast({ title: `Exported as ${fmt.toUpperCase()}`, variant: 'success' });
    } catch (err) {
      toast({ title: 'Export failed', description: handleApiError(err), variant: 'error' });
    } finally {
      setExporting(null);
    }
  };

  const openShare = () => {
    setShare(null);
    setCopied(false);
    setShareOpen(true);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const created = await createShare({
        sql: response.sql ?? '',
        question: response.question ?? null,
        title: response.question ?? null,
        rows,
        expires_in_days: expiry ? Number(expiry) : null,
      });
      setShare(created);
      toast({ title: 'Share link created', variant: 'success' });
    } catch (err) {
      toast({ title: 'Could not create link', description: handleApiError(err), variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Could not copy link', variant: 'error' });
    }
  };

  const handleEmail = async () => {
    if (!share || !email) return;
    setSendingEmail(true);
    try {
      const res = await emailShare(share.id, email);
      toast({ title: res.message, variant: res.sent ? 'success' : 'info' });
    } catch (err) {
      toast({ title: 'Email failed', description: handleApiError(err), variant: 'error' });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSlack = async () => {
    if (!share) return;
    setSendingSlack(true);
    try {
      const res = await slackShare(share.id);
      toast({ title: res.message, variant: res.sent ? 'success' : 'info' });
    } catch (err) {
      toast({ title: 'Slack send failed', description: handleApiError(err), variant: 'error' });
    } finally {
      setSendingSlack(false);
    }
  };

  const handleRevoke = async () => {
    if (!share) return;
    setRevoking(true);
    try {
      await revokeShare(share.id);
      toast({ title: 'Share link revoked', variant: 'success' });
      setShare(null);
      setShareOpen(false);
    } catch (err) {
      toast({ title: 'Revoke failed', description: handleApiError(err), variant: 'error' });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          disabled={exporting !== null}
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Export as</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {EXPORT_FORMATS.map(({ fmt, label }) => (
            <DropdownMenuItem key={fmt} onClick={() => handleExport(fmt)}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="secondary" size="sm" onClick={openShare}>
        <Share2 className="h-4 w-4" /> Share
      </Button>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent showClose onClose={() => setShareOpen(false)}>
          <DialogHeader>
            <DialogTitle>Share query</DialogTitle>
            <DialogDescription>
              Anyone with the link can view this query and its result snapshot.
            </DialogDescription>
          </DialogHeader>

          {!share ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Link expiration</label>
                <select
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none [&>option]:bg-popover"
                >
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                Create link
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Input readOnly value={share.url} className="flex-1 font-mono text-xs" />
                <Button variant="secondary" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="email"
                  placeholder="teammate@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Button variant="secondary" size="sm" onClick={handleEmail} disabled={sendingEmail || !email}>
                  {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Email
                </Button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button variant="secondary" size="sm" onClick={handleSlack} disabled={sendingSlack}>
                  {sendingSlack ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send to Slack
                </Button>
                <Button variant="destructive" size="sm" onClick={handleRevoke} disabled={revoking}>
                  {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Revoke
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExportShareControls;
