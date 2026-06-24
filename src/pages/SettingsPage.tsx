import { useState } from 'react';
import { cn } from '@/lib/utils';
import GeneralSettings from '../features/settings/General';
import SqlStyleSettings from '../features/settings/SqlStyle';
import InstructionsSettings from '../features/settings/Instructions';
import DataPrivacySettings from '../features/settings/DataPrivacy';
import SecuritySettings from '../features/settings/Security';
import AppearanceSettings from '../features/settings/Appearance';
import NotificationsSettings from '../features/settings/Notifications';
import GlossarySettings from '../features/settings/GlossarySettings';
import UsagePanel from '../features/usage/UsagePanel';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'sql-style', label: 'SQL Style' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'glossary', label: 'Glossary' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'usage', label: 'Usage' },
  { id: 'data-privacy', label: 'Data & Privacy' },
  { id: 'security', label: 'Security' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('general');

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex w-full gap-1 overflow-x-auto rounded-xl border border-border bg-background/60 p-1 custom-scrollbar">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'shrink-0 flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              tab === id
                ? 'bg-gradient-to-r from-primary/20 to-primary/20 text-foreground shadow-[inset_0_0_0_1px_rgba(16,185,129,0.3)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralSettings />}
      {tab === 'appearance' && <AppearanceSettings />}
      {tab === 'sql-style' && <SqlStyleSettings />}
      {tab === 'instructions' && <InstructionsSettings />}
      {tab === 'glossary' && <GlossarySettings />}
      {tab === 'notifications' && <NotificationsSettings />}
      {tab === 'usage' && <UsagePanel />}
      {tab === 'data-privacy' && <DataPrivacySettings />}
      {tab === 'security' && <SecuritySettings />}
    </div>
  );
}
