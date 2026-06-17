import { useState, useEffect, useRef } from 'react';
import { X, Zap, Activity, TrendingUp, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getUsage } from '../api/client';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Period = 'today' | '7d' | '30d';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function UsageModal({ open, onClose }: Props) {
  const [period, setPeriod] = useState<Period>('7d');
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['usage', period],
    queryFn: () => getUsage(period),
    enabled: open,
    staleTime: 60_000,
  });

  if (!open) return null;

  const stats = [
    {
      label: 'Queries run',
      value: data ? fmt(data.queries_used) : '—',
      icon: Activity,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Tokens in',
      value: data ? fmt(data.tokens_in) : '—',
      icon: TrendingUp,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Tokens out',
      value: data ? fmt(data.tokens_out) : '—',
      icon: Zap,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
    },
    {
      label: 'Est. cost',
      value: data ? `$${data.est_cost_usd.toFixed(4)}` : '—',
      icon: DollarSign,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
  ];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">Usage</h2>
            <p className="text-xs text-muted-foreground">Token consumption &amp; cost</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Period selector */}
        <div className="flex gap-1.5 px-6 pt-4">
          {PERIODS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPeriod(id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                period === id
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground border border-border hover:bg-foreground/5 hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 p-6">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-background/50 p-4"
            >
              <div className={cn('mb-3 flex h-8 w-8 items-center justify-center rounded-lg', bg)}>
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', isLoading ? 'animate-pulse text-muted-foreground' : 'text-foreground')}>
                {isLoading ? '…' : value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {isError && (
          <p className="px-6 pb-4 text-center text-xs text-rose-400">
            Failed to load usage data.
          </p>
        )}
      </div>
    </div>
  );
}
