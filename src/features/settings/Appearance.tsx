import { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { Label } from '../../components/ui/label';
import { FormMessage } from '../../components/ui/form-message';
import { cn } from '@/lib/utils';
import InfoTip from '../../components/InfoTip';

function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary animate-fade-in">
      <Check className="h-3.5 w-3.5" /> Saved
    </span>
  );
}

function RadioGroup<T extends string>({
  label,
  hint,
  info,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  info?: string;
  value: T;
  options: { value: T; label: string; description: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label>
          {label}
          {info && <InfoTip text={info} />}
        </Label>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex flex-col items-start rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              value === opt.value
                ? 'border-primary/50 bg-primary/10 text-foreground'
                : 'border-border bg-background/50 text-muted-foreground hover:text-foreground hover:border-border/80',
            )}
          >
            <span className={cn('text-sm font-semibold', value === opt.value && 'text-primary')}>
              {opt.label}
            </span>
            <span className="mt-0.5 text-xs leading-snug opacity-70">{opt.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AppearanceSettings() {
  const { settings, updateSettings } = useSettings();
  const [form, setForm] = useState({
    font_size: settings.font_size,
    ui_density: settings.ui_density,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setForm({ font_size: settings.font_size, ui_density: settings.ui_density });
  }, [settings.font_size, settings.ui_density]);

  const commit = async (next: typeof form) => {
    setForm(next);
    try {
      setError('');
      await updateSettings({ font_size: next.font_size, ui_density: next.ui_density });
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1500);
    } catch {
      setError('Failed to save appearance settings');
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <RadioGroup
        label="Font Size"
        hint="Controls text size across the application. Changes take effect immediately."
        info="Sets the base font size for the entire app. Small = 13px, Medium = 16px (default), Large = 18px. All spacing scales proportionally since Tailwind uses rem units."
        value={form.font_size}
        onChange={(v) => commit({ ...form, font_size: v })}
        options={[
          { value: 'small', label: 'Small', description: 'Compact text — 13px base, fits more content' },
          { value: 'medium', label: 'Medium', description: 'Default — 16px, balanced readability' },
          { value: 'large', label: 'Large', description: 'Easier to read — 18px, ideal for high-DPI' },
        ]}
      />

      <RadioGroup
        label="UI Density"
        hint="Controls spacing and padding throughout the interface. Changes take effect immediately."
        info="Scales all padding, margins, and gaps in the app. Compact = tighter layout showing more content. Spacious = more breathing room, easier to click."
        value={form.ui_density}
        onChange={(v) => commit({ ...form, ui_density: v })}
        options={[
          { value: 'compact', label: 'Compact', description: 'Tighter spacing — more visible on screen' },
          { value: 'comfortable', label: 'Comfortable', description: 'Balanced spacing (default)' },
          { value: 'spacious', label: 'Spacious', description: 'Generous padding — easier to navigate' },
        ]}
      />

      <div className="flex items-center gap-2 pt-1">
        <FormMessage>{error}</FormMessage>
        <SavedBadge show={saved && !error} />
      </div>
    </div>
  );
}
