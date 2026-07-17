/**
 * SettingsModal — the single settings surface for the app.
 *
 * Renders the exact same 10 feature panels the old /settings page used, inside a
 * centered squarish popup (left tab rail + scrollable content). Keeping ONE set
 * of panels avoids the historical page-vs-modal drift that once hid a shipped
 * feature. Matches the ProfileModal/UsageModal overlay + focus-trap pattern.
 */
import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/components/ui/dialog';
import GeneralSettings from '../features/settings/General';
import SqlStyleSettings from '../features/settings/SqlStyle';
import InstructionsSettings from '../features/settings/Instructions';
import DataPrivacySettings from '../features/settings/DataPrivacy';
import SecuritySettings from '../features/settings/Security';
import AppearanceSettings from '../features/settings/Appearance';
import NotificationsSettings from '../features/settings/Notifications';
import GlossarySettings from '../features/settings/GlossarySettings';
import RagSettings from '../features/settings/RagSettings';
import UsagePanel from '../features/usage/UsagePanel';

const TABS = [
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

type TabId = (typeof TABS)[number]['id'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('general');
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, contentRef);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

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
        className="relative flex h-[82vh] max-h-[760px] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-popover shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] animate-slide-up focus:outline-none"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-semibold leading-tight text-foreground">Settings</h2>
            <p className="text-xs text-muted-foreground/70">Preferences, privacy &amp; security</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-xl p-2 text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body: left tab rail + scrollable content */}
        <div className="flex min-h-0 flex-1">
          <nav className="w-40 shrink-0 space-y-1 overflow-y-auto border-r border-border bg-background/40 p-2 custom-scrollbar">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  tab === id
                    ? 'bg-gradient-to-r from-primary/20 to-primary/20 text-foreground shadow-[inset_0_0_0_1px_rgba(16,185,129,0.3)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]',
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
            {tab === 'general' && <GeneralSettings />}
            {tab === 'appearance' && <AppearanceSettings />}
            {tab === 'sql-style' && <SqlStyleSettings />}
            {tab === 'instructions' && <InstructionsSettings />}
            {tab === 'glossary' && <GlossarySettings />}
            {tab === 'rag' && <RagSettings />}
            {tab === 'notifications' && <NotificationsSettings />}
            {tab === 'usage' && <UsagePanel />}
            {tab === 'data-privacy' && <DataPrivacySettings />}
            {tab === 'security' && <SecuritySettings />}
          </div>
        </div>
      </div>
    </div>
  );
}
