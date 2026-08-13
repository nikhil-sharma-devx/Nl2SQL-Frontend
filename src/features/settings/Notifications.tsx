import { useId } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotificationPrefs, updateNotificationPrefs, type NotificationPrefs } from '../../api/client';
import { Skeleton } from '../../components/ui/skeleton';
import { FormMessage } from '../../components/ui/form-message';
import { cn } from '@/lib/utils';

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  const labelId = useId();
  const descId = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card/30 p-4">
      <div className="flex-1">
        <p id={labelId} className="text-sm font-medium text-foreground">{label}</p>
        {description && <p id={descId} className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          checked ? 'border-primary bg-primary' : 'border-border bg-border/40',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'left-3.5' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}

export default function NotificationsSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<NotificationPrefs>({
    queryKey: ['notification-prefs'],
    queryFn: getNotificationPrefs,
  });

  const mutation = useMutation({
    mutationFn: (updates: Partial<NotificationPrefs>) => updateNotificationPrefs(updates),
    onSuccess: (updated) => {
      queryClient.setQueryData(['notification-prefs'], updated);
    },
  });

  const toggle = (key: keyof NotificationPrefs) => {
    if (!data) return;
    mutation.mutate({ [key]: !data[key] });
  };

  if (isLoading) {
    return (
      <div className="space-y-3 max-w-lg">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  const prefs = data ?? { email_digest: false, in_app_enabled: true, marketing_enabled: false };

  return (
    <div className="space-y-3 max-w-lg">
      <p className="text-sm text-muted-foreground mb-4">
        Control how and when you receive notifications. Changes are saved instantly.
      </p>

      <Toggle
        checked={prefs.in_app_enabled}
        onChange={() => toggle('in_app_enabled')}
        label="In-App Notifications"
        description="Show alerts and status messages within the application."
      />

      <Toggle
        checked={prefs.email_digest}
        onChange={() => toggle('email_digest')}
        label="Email Digest"
        description="Receive a weekly email summarizing your query activity. Every email includes a one-click unsubscribe link."
      />

      <Toggle
        checked={prefs.marketing_enabled}
        onChange={() => toggle('marketing_enabled')}
        label="Product Updates & Tips"
        description="Occasional emails about new features and usage tips."
      />

      <FormMessage>{mutation.isError ? 'Failed to save preference. Please try again.' : ''}</FormMessage>
    </div>
  );
}
