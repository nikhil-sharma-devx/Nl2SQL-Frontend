/**
 * CommandPalette — Ctrl+K / Cmd+K global navigator (item: command palette).
 *
 * Self-contained overlay: reads open/closed state from CommandPaletteContext,
 * renders a searchable, keyboard-navigable list of every page plus a couple
 * of high-frequency actions. Built entirely from existing primitives (portal
 * + Tailwind classes already used by ShortcutOverlay/DropdownMenu) — no new
 * dependency.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  SquarePen,
  Settings,
  Home,
  Database,
  Upload,
  Clock,
  BarChart3,
  Bookmark,
  LayoutDashboard,
  Clock3,
  BadgeCheck,
  FileCode2,
  BrainCircuit,
  HelpCircle,
  CornerDownLeft,
  type LucideIcon,
} from 'lucide-react';
import { useFocusTrap } from '@/components/ui/dialog';
import { useCommandPalette } from '@/context/CommandPaletteContext';
import { cn } from '@/lib/utils';

interface Command {
  key: string;
  label: string;
  hint?: string;
  keywords?: string;
  icon: LucideIcon;
  group: 'Actions' | 'Pages';
  run: (navigate: ReturnType<typeof useNavigate>) => void;
}

const COMMANDS: Command[] = [
  {
    key: 'new-chat',
    label: 'New query',
    hint: 'Start a fresh conversation',
    keywords: 'new chat query ask',
    icon: SquarePen,
    group: 'Actions',
    run: (navigate) => navigate('/query', { state: { newChat: true } }),
  },
  {
    key: 'settings',
    label: 'Open settings',
    keywords: 'preferences config',
    icon: Settings,
    group: 'Actions',
    run: (navigate) => navigate('/settings'),
  },
  { key: 'home', label: 'Home', keywords: 'dashboard overview', icon: Home, group: 'Pages', run: (n) => n('/') },
  { key: 'query', label: 'Query', keywords: 'chat ask sql', icon: Database, group: 'Pages', run: (n) => n('/query') },
  { key: 'schema', label: 'Schema', keywords: 'connections databases upload ingest', icon: Upload, group: 'Pages', run: (n) => n('/schema') },
  { key: 'history', label: 'History', keywords: 'sessions past conversations', icon: Clock, group: 'Pages', run: (n) => n('/history') },
  { key: 'analytics', label: 'Analytics', keywords: 'usage accuracy performance', icon: BarChart3, group: 'Pages', run: (n) => n('/analytics') },
  { key: 'saved', label: 'Saved Queries', keywords: 'bookmarks starred sql', icon: Bookmark, group: 'Pages', run: (n) => n('/saved') },
  { key: 'dashboards', label: 'Dashboards', keywords: 'charts widgets', icon: LayoutDashboard, group: 'Pages', run: (n) => n('/dashboards') },
  { key: 'schedules', label: 'Scheduled Queries', keywords: 'cron alerts recurring', icon: Clock3, group: 'Pages', run: (n) => n('/schedules') },
  { key: 'metrics', label: 'Metrics Catalog', keywords: 'certified business metrics', icon: BadgeCheck, group: 'Pages', run: (n) => n('/metrics') },
  { key: 'templates', label: 'Query Templates', keywords: 'parameterized patterns', icon: FileCode2, group: 'Pages', run: (n) => n('/templates') },
  { key: 'training', label: 'Model Training', keywords: 'fine-tune finetune', icon: BrainCircuit, group: 'Pages', run: (n) => n('/training') },
  { key: 'help', label: 'Help', keywords: 'docs faq shortcuts', icon: HelpCircle, group: 'Pages', run: (n) => n('/help') },
];

function matches(cmd: Command, query: string): boolean {
  if (!query) return true;
  const haystack = `${cmd.label} ${cmd.keywords ?? ''}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export default function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, containerRef);

  const results = useMemo(() => COMMANDS.filter((c) => matches(c, query)), [query]);

  // Reset transient state whenever the palette opens; focus the search box.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const runAt = (index: number) => {
    const cmd = results[index];
    if (!cmd) return;
    cmd.run(navigate);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(activeIndex);
    }
  };

  if (!open) return null;

  let renderIndex = -1;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl animate-slide-up"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, jump to a section…"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            aria-label="Search commands"
          />
          <kbd className="shrink-0 rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto custom-scrollbar p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground/60">
              No matches for &ldquo;{query}&rdquo;
            </p>
          ) : (
            ['Actions', 'Pages'].map((group) => {
              const items = results.filter((c) => c.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="mb-1 last:mb-0">
                  <p className="px-3 pb-1 pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50">
                    {group}
                  </p>
                  {items.map((cmd) => {
                    renderIndex += 1;
                    const idx = renderIndex;
                    const isActive = idx === activeIndex;
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.key}
                        type="button"
                        data-active={isActive}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => runAt(idx)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                          isActive ? 'bg-foreground/[0.07] text-foreground' : 'text-foreground/80 hover:bg-foreground/[0.04]',
                        )}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/70')} />
                        <span className="flex-1 truncate">{cmd.label}</span>
                        {cmd.hint && <span className="shrink-0 text-xs text-muted-foreground/50">{cmd.hint}</span>}
                        {isActive && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
