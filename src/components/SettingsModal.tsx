import { useState, useEffect, useRef } from 'react';
import { X, Settings, Database, FileText, Shield, Lock, Sliders } from 'lucide-react';
import { cn } from '@/lib/utils';
import GeneralSettings from '../features/settings/General';
import SqlStyleSettings from '../features/settings/SqlStyle';
import InstructionsSettings from '../features/settings/Instructions';
import DataPrivacySettings from '../features/settings/DataPrivacy';
import SecuritySettings from '../features/settings/Security';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TABS = [
  { id: 'general', label: 'General', icon: Sliders },
  { id: 'sql-style', label: 'SQL Style', icon: Database },
  { id: 'instructions', label: 'Instructions', icon: FileText },
  { id: 'data-privacy', label: 'Data & Privacy', icon: Shield },
  { id: 'security', label: 'Security', icon: Lock },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function SettingsModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('general');
  const overlayRef = useRef<HTMLDivElement>(null);

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

  // Reset tab to general when opening
  useEffect(() => {
    if (open) setTab('general');
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="relative flex w-full max-w-5xl h-[85vh] max-h-[800px] rounded-3xl border border-border bg-popover shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] overflow-hidden animate-slide-up flex-col md:flex-row">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card/50 flex flex-col shrink-0">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-border/50 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary text-primary-foreground shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <Settings size={18} />
            </div>
            <h2 className="font-semibold text-foreground tracking-tight text-lg">Settings</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  tab === id
                    ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]'
                    : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
                )}
              >
                <Icon size={16} className={cn(tab === id ? 'text-primary' : 'text-muted-foreground/70')} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-background/30">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
            <h3 className="font-semibold text-foreground text-lg">
              {TABS.find(t => t.id === tab)?.label}
            </h3>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <div className="mx-auto max-w-3xl">
              {tab === 'general' && <GeneralSettings />}
              {tab === 'sql-style' && <SqlStyleSettings />}
              {tab === 'instructions' && <InstructionsSettings />}
              {tab === 'data-privacy' && <DataPrivacySettings />}
              {tab === 'security' && <SecuritySettings />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
