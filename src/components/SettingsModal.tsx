/**
 * SettingsModal — the single settings surface for the app.
 *
 * Renders the same feature panels the old /settings page used, inside a
 * centered squarish popup (left tab rail + scrollable content on md+, a
 * horizontal scrollable pill row on smaller screens). Keeping ONE set of
 * panels avoids the historical page-vs-modal drift that once hid a shipped
 * feature. Matches the ProfileModal/UsageModal overlay + focus-trap pattern.
 */
import { useState, useEffect, useRef } from 'react';
import { X, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import GeneralSettings from '../features/settings/General';
import SqlStyleSettings from '../features/settings/SqlStyle';
import InstructionsSettings from '../features/settings/Instructions';
import DataPrivacySettings from '../features/settings/DataPrivacy';
import SecuritySettings from '../features/settings/Security';
import AppearanceSettings from '../features/settings/Appearance';
import NotificationsSettings from '../features/settings/Notifications';
import GlossarySettings from '../features/settings/GlossarySettings';
import RagSettings from '../features/settings/RagSettings';
import UsageModal from './UsageModal';
import { useAuth } from '@/context/AuthContext';

const ALL_TABS = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'sql-style', label: 'SQL Style' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'glossary', label: 'Glossary' },
  { id: 'rag', label: 'RAG' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'usage', label: 'Usage' },
  { id: 'data-privacy', label: 'Data & Privacy' },
  { id: 'security', label: 'Security' },
] as const;

type TabId = (typeof ALL_TABS)[number]['id'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: Props) {
  const { user } = useAuth();
  // RAG config is a global (not per-user) setting gated admin-only on the
  // backend — hide the tab for everyone else instead of letting them fill it
  // out and only find out it's rejected on save.
  const TABS = user?.is_admin ? ALL_TABS : ALL_TABS.filter((t) => t.id !== 'rag');
  const [tab, setTab] = useState<TabId>('general');
  const [usageOpen, setUsageOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, contentRef);

  // Close on Escape — deferred to the nested Usage modal's own handler while it's open,
  // so dismissing Usage doesn't also close Settings underneath it.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !usageOpen) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, usageOpen]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

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
        aria-label="Settings"
        tabIndex={-1}
        className="relative flex h-[86vh] max-h-[760px] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-popover shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] animate-slide-up focus:outline-none"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4 sm:px-6">
          <div>
            <h2 className="font-semibold leading-tight text-foreground">Settings</h2>
            <p className="text-xs text-muted-foreground/70">Preferences, privacy &amp; security</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-xl p-2 text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab rail — horizontal scrollable pill row below md, vertical rail at md+ */}
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border bg-background/40 p-2 custom-scrollbar snap-x snap-mandatory md:hidden"
        >
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'shrink-0 snap-start cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                tab === id
                  ? 'bg-gradient-to-r from-primary/20 to-primary/20 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_30%,transparent)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]',
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Body: left tab rail (md+) + scrollable content */}
        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="Settings sections"
            className="hidden w-40 shrink-0 space-y-1 overflow-y-auto border-r border-border bg-background/40 p-2 custom-scrollbar md:block"
          >
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  tab === id
                    ? 'bg-gradient-to-r from-primary/20 to-primary/20 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_30%,transparent)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]',
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 custom-scrollbar sm:px-6 sm:py-5">
            {tab === 'general' && <GeneralSettings />}
            {tab === 'appearance' && <AppearanceSettings />}
            {tab === 'sql-style' && <SqlStyleSettings />}
            {tab === 'instructions' && <InstructionsSettings />}
            {tab === 'glossary' && <GlossarySettings />}
            {tab === 'rag' && user?.is_admin && <RagSettings />}
            {tab === 'notifications' && <NotificationsSettings />}
            {tab === 'usage' && (
              <div className="max-w-md space-y-3">
                <div className="rounded-2xl border border-border bg-card/40 p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-semibold text-foreground">Usage</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    View your token consumption, query counts, and estimated cost.
                  </p>
                  <Button className="mt-4" onClick={() => setUsageOpen(true)}>
                    View Usage
                  </Button>
                </div>
              </div>
            )}
            {tab === 'data-privacy' && <DataPrivacySettings />}
            {tab === 'security' && <SecuritySettings />}
          </div>
        </div>
      </div>

      <UsageModal open={usageOpen} onClose={() => setUsageOpen(false)} />
    </div>
  );
}
