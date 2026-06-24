import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { getOnboarding, patchTutorialProgress, type OnboardingState } from '../api/client';
import { getTutorialProgress } from '../api/client';
import { cn } from '@/lib/utils';

const ITEM_LABELS: Record<string, string> = {
  connect_database: 'Connect your database',
  run_first_query: 'Run your first query',
  save_a_query: 'Save a query',
  pin_a_table: 'Pin a table',
  add_custom_instructions: 'Add custom instructions',
  add_glossary_term: 'Add a glossary term',
  explore_templates: 'Explore query templates',
};

export default function OnboardingChecklist() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);

  const { data: onboarding } = useQuery<OnboardingState>({
    queryKey: ['onboarding'],
    queryFn: getOnboarding,
    staleTime: 30_000,
  });

  const { data: tutorial } = useQuery({
    queryKey: ['tutorial-progress'],
    queryFn: getTutorialProgress,
    staleTime: 30_000,
  });

  const dismissMutation = useMutation({
    mutationFn: () => patchTutorialProgress({ dismissed: true }),
    onSuccess: () => {
      queryClient.setQueryData(['tutorial-progress'], (old: any) => ({ ...old, dismissed_at: new Date().toISOString() }));
    },
  });

  // Hide if dismissed or fully complete
  if (tutorial?.dismissed_at) return null;
  if (!onboarding) return null;
  if ((onboarding.progress_pct ?? 0) >= 100) return null;

  const completed = new Set(onboarding.completed_items ?? []);
  const items = onboarding.available_items ?? Object.keys(ITEM_LABELS);
  const pct = onboarding.progress_pct ?? 0;

  return (
    <div className="mx-2 mb-2 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <span className="text-xs font-semibold text-foreground">Getting Started</span>
          <span className="ml-auto text-xs font-mono text-primary">{pct}%</span>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        <button
          onClick={() => dismissMutation.mutate()}
          className="ml-2 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mx-3 h-1 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Items */}
      {expanded && (
        <div className="px-3 py-2 space-y-1">
          {items.map((item) => {
            const done = completed.has(item);
            return (
              <div key={item} className={cn('flex items-center gap-2 text-xs', done ? 'text-muted-foreground line-through' : 'text-foreground')}>
                <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', done ? 'border-primary bg-primary' : 'border-border')}>
                  {done && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                </span>
                {ITEM_LABELS[item] ?? item.replace(/_/g, ' ')}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
