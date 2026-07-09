/**
 * ProfileModal — centered settings popup for API key management.
 * Respects the active theme via CSS variables; no hardcoded colours.
 */
import { useState, useEffect, useRef } from 'react';
import {
  X,
  Key,
  Eye,
  EyeOff,
  Check,
  Trash2,
  Loader2,
  ShieldCheck,
  ServerCrash,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import {
  getAPIKeyStatus,
  saveAPIKey,
  deleteAPIKey,
  handleApiError,
  type APIKeyStatusItem,
} from '../api/client';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PROVIDER_ICONS: Record<string, string> = {
  groq: 'G',
  openai: '⬡',
  anthropic: 'A',
  gemini: '✦',
  together: 'T',
};

function ProviderCard({
  item,
  onSaved,
  onDeleted,
}: {
  item: APIKeyStatusItem;
  onSaved: (preview: string) => void;
  onDeleted: () => void;
}) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await saveAPIKey(item.provider, value.trim());
      setValue('');
      setSuccess(res.message);
      onSaved(res.key_preview);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteAPIKey(item.provider);
      setSuccess('Key removed. Will fall back to server key.');
      onDeleted();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  const sourceLabel = item.has_user_key
    ? 'Your key active'
    : item.has_server_key
    ? 'Server key active'
    : 'No key configured';

  const sourceDot = item.has_user_key
    ? 'bg-primary'
    : item.has_server_key
    ? 'bg-amber-400'
    : 'bg-rose-500';

  return (
    <div className="rounded-2xl border border-border bg-foreground/[0.02] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.06] font-bold text-sm text-foreground/80">
            {PROVIDER_ICONS[item.provider] ?? item.provider[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{item.label}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', sourceDot)} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                {sourceLabel}
              </span>
            </div>
          </div>
        </div>

        {item.has_user_key && item.key_preview && (
          <span className="font-mono text-[11px] text-muted-foreground/70 bg-foreground/[0.05] px-2 py-0.5 rounded-md">
            {item.key_preview}
          </span>
        )}
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Key size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type={show ? 'text' : 'password'}
            placeholder={item.has_user_key ? 'Replace existing key…' : 'Paste your API key…'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            className="w-full rounded-xl border border-border bg-background pl-8 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            tabIndex={-1}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground/80"
          >
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={!value.trim() || saving}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Save
        </button>

        {item.has_user_key && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Remove your key"
            className="flex items-center justify-center rounded-xl border border-border bg-foreground/[0.03] p-2 text-muted-foreground/70 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-40"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        )}
      </div>

      {/* Feedback */}
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-rose-400">
          <AlertCircle size={12} /> {error}
        </p>
      )}
      {success && (
        <p className="flex items-center gap-1.5 text-xs text-primary">
          <Check size={12} /> {success}
        </p>
      )}

      {/* Models hint */}
      <div className="flex flex-wrap gap-1.5">
        {item.available_models.map((m) => (
          <span key={m} className="rounded-md bg-foreground/[0.05] px-2 py-0.5 font-mono text-[10px] text-muted-foreground/70">
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ProfileModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const [keys, setKeys] = useState<APIKeyStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, contentRef);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setLoadError(null);
    getAPIKeyStatus()
      .then((res) => setKeys(res.keys))
      .catch((err) => setLoadError(handleApiError(err)))
      .finally(() => setLoading(false));
  }, [open]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const initial = (user?.full_name ?? user?.email ?? 'U')[0].toUpperCase();

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label="Profile and API keys"
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-3xl border border-border bg-popover shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] overflow-hidden animate-slide-up focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary text-primary-foreground font-bold text-lg shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              {initial}
            </div>
            <div>
              <p className="font-semibold text-foreground leading-tight">{user?.full_name ?? 'User'}</p>
              <p className="font-mono text-[11px] text-muted-foreground/70">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto custom-scrollbar px-6 py-5 space-y-6">
          {/* API Keys section */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={14} className="text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/80">
                Personal API Keys
              </h3>
            </div>
            <p className="mb-4 text-xs text-muted-foreground/70 leading-relaxed">
              Your key takes priority over the server key. Stored encrypted — never exposed in plain text.
            </p>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground/70 py-4">
                <Loader2 size={15} className="animate-spin" /> Loading…
              </div>
            )}

            {loadError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-400">
                <ServerCrash size={14} /> {loadError}
              </div>
            )}

            {!loading && !loadError && (
              <div className="space-y-3">
                {keys.map((item) => (
                  <ProviderCard
                    key={item.provider}
                    item={item}
                    onSaved={(preview) =>
                      setKeys((prev) =>
                        prev.map((k) =>
                          k.provider === item.provider
                            ? { ...k, has_user_key: true, key_preview: preview }
                            : k,
                        ),
                      )
                    }
                    onDeleted={() =>
                      setKeys((prev) =>
                        prev.map((k) =>
                          k.provider === item.provider
                            ? { ...k, has_user_key: false, key_preview: null }
                            : k,
                        ),
                      )
                    }
                  />
                ))}
              </div>
            )}
          </section>


        </div>
      </div>
    </div>
  );
}
