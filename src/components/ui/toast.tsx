/**
 * Minimal dependency-free toast system.
 *
 * Usage:
 *   toast({ title: 'Saved', variant: 'success' })
 *   toast({ title: 'Request failed', description: 'Ref: abc123', variant: 'error' })
 *
 * Mount <Toaster /> once (done in App.tsx). Toasts auto-dismiss after 5s
 * (8s for errors) and can be dismissed by click.
 */
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'info' | 'success' | 'error';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, 'title' | 'variant'>> {
  id: number;
  description?: string;
  durationMs: number;
}

type Listener = (toasts: ToastItem[]) => void;

let nextId = 1;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

// In-app notification preference (Settings → Notifications → "In-App Notifications").
// When disabled, informational/success toasts are suppressed; errors always show so
// failures are never silently hidden. Synced from the server pref by <Layout>.
let inAppEnabled = true;
export function setInAppNotificationsEnabled(enabled: boolean): void {
  inAppEnabled = enabled;
}

const notify = () => listeners.forEach((l) => l(toasts));

export function toast(opts: ToastOptions): void {
  const variant: ToastVariant = opts.variant ?? 'info';
  // Respect the user's in-app-notifications preference for non-critical toasts.
  if (!inAppEnabled && variant !== 'error') return;

  const item: ToastItem = {
    id: nextId++,
    title: opts.title,
    description: opts.description,
    variant,
    durationMs: opts.durationMs ?? (variant === 'error' ? 8000 : 5000),
  };
  // De-duplicate identical back-to-back toasts (e.g. repeated failed polls)
  const last = toasts[toasts.length - 1];
  if (last && last.title === item.title && last.description === item.description) return;

  toasts = [...toasts.slice(-3), item]; // keep at most 4 on screen
  notify();
  window.setTimeout(() => dismissToast(item.id), item.durationMs);
}

export function dismissToast(id: number): void {
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: 'border-border',
  success: 'border-primary/35',
  error: 'border-destructive-border',
};

const VARIANT_ICON_COLOR: Record<ToastVariant, string> = {
  info: 'text-info-text',
  success: 'text-primary',
  error: 'text-destructive-text',
};

const VARIANT_BAR_COLOR: Record<ToastVariant, string> = {
  info: 'bg-info-text',
  success: 'bg-primary',
  error: 'bg-destructive',
};

const VARIANT_ICON: Record<ToastVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>(toasts);

  useEffect(() => {
    const listener: Listener = (next) => setItems(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2"
    >
      {items.map((t) => {
        const Icon = VARIANT_ICON[t.variant];
        return (
          <div
            key={t.id}
            className={`glass-strong pointer-events-auto relative animate-slide-up overflow-hidden rounded-xl border p-3 pb-4 text-foreground ${VARIANT_STYLES[t.variant]}`}
          >
            <div className="flex items-start gap-2.5">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${VARIANT_ICON_COLOR[t.variant]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
                className="rounded p-0.5 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div
              className={`absolute inset-x-0 bottom-0 h-0.5 origin-left ${VARIANT_BAR_COLOR[t.variant]}`}
              style={{ animation: `toastShrink ${t.durationMs}ms linear forwards` }}
              aria-hidden="true"
            />
          </div>
        );
      })}
    </div>
  );
}
