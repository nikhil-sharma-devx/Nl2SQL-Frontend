import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Keyboard, X } from 'lucide-react';
import { useFocusTrap } from '@/components/ui/dialog';

/**
 * Global keyboard-shortcut cheatsheet (item 16).
 *
 * Opens when the user presses "?" (Shift + /) anywhere except while typing in
 * an input / textarea / contenteditable, and closes on Escape or "?" again.
 * Self-contained: mount it once (in Layout) — it manages its own open state and
 * global key listener.
 */

interface Shortcut {
  keys: string[];
  label: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Enter'], label: 'Submit query' },
  { keys: ['Ctrl', 'Enter'], label: 'Submit query' },
  { keys: ['Shift', 'Enter'], label: 'New line in the query box' },
  { keys: ['↑', '↓'], label: 'Move through autocomplete suggestions' },
  { keys: ['Alt', 'N'], label: 'Start a new chat' },
  { keys: ['Esc'], label: 'Close dialog / dismiss suggestions' },
  { keys: ['?'], label: 'Show / hide this shortcuts panel' },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  );
}

export default function ShortcutOverlay() {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, contentRef);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      // "?" is Shift + "/" — ignore while typing so it doesn't hijack input.
      if (e.key === '?' && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-popover/95 p-6 text-popover-foreground shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl animate-slide-up focus:outline-none"
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Keyboard className="h-4 w-4" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Keyboard shortcuts
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="space-y-2.5">
          {SHORTCUTS.map(({ keys, label }) => (
            <li key={`${keys.join('+')}-${label}`} className="flex items-center justify-between gap-4">
              <span className="text-sm text-foreground/90">{label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {keys.map((k, i) => (
                  <span key={k} className="flex items-center gap-1">
                    {i > 0 && k !== '↓' && (
                      <span className="text-[10px] text-muted-foreground/60">+</span>
                    )}
                    <kbd className="rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {k}
                    </kbd>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
