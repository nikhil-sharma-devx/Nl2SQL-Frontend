import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';

type Period = 'today' | '7d' | '30d';

interface UsageData {
  queries_used: number;
  tokens_in: number;
  tokens_out: number;
  est_cost_usd: number;
  period: string;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];

export default function UsagePanel() {
  const [period, setPeriod] = useState<Period>('7d');

  const { data, isLoading } = useQuery<UsageData>({
    queryKey: ['usage', period],
    queryFn: () => apiClient.get('/usage', { params: { period } }).then(r => r.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              period === p.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/40'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Queries"
          value={data?.queries_used ?? 0}
          isLoading={isLoading}
        />
        <StatCard
          label="Tokens In"
          value={data?.tokens_in ?? 0}
          isLoading={isLoading}
          format="number"
        />
        <StatCard
          label="Tokens Out"
          value={data?.tokens_out ?? 0}
          isLoading={isLoading}
          format="number"
        />
        <StatCard
          label="Est. Cost"
          value={data?.est_cost_usd ?? 0}
          isLoading={isLoading}
          format="currency"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  isLoading,
  format = 'integer',
}: {
  label: string;
  value: number;
  isLoading: boolean;
  format?: 'integer' | 'number' | 'currency';
}) {
  const display =
    format === 'currency'
      ? `$${value.toFixed(4)}`
      : format === 'number'
      ? value.toLocaleString()
      : value.toString();

  return (
    <Card className="border-border bg-card/60">
      <CardHeader className="pb-1 pt-3">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        {isLoading ? (
          <Skeleton className="h-6 w-16" />
        ) : (
          <p className="text-xl font-bold text-foreground">{display}</p>
        )}
      </CardContent>
    </Card>
  );
}
