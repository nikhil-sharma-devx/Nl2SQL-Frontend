import { useState, useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { cn } from '@/lib/utils';

function RadioGroup<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string; description: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex flex-col items-start rounded-xl border p-3 text-left transition-all',
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
  const { settings, updateSettings, isSaving } = useSettings();
  const [form, setForm] = useState({
    font_size: settings.font_size,
    ui_density: settings.ui_density,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({ font_size: settings.font_size, ui_density: settings.ui_density });
  }, [settings.font_size, settings.ui_density]);

  const handleSave = async () => {
    try {
      setError('');
      await updateSettings({ font_size: form.font_size, ui_density: form.ui_density });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save appearance settings');
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <RadioGroup
        label="Font Size"
        hint="Controls text size across the application."
        value={form.font_size}
        onChange={(v) => setForm(f => ({ ...f, font_size: v }))}
        options={[
          { value: 'small', label: 'Small', description: 'Compact, more content visible' },
          { value: 'medium', label: 'Medium', description: 'Default balance' },
          { value: 'large', label: 'Large', description: 'Easier on the eyes' },
        ]}
      />

      <RadioGroup
        label="UI Density"
        hint="Controls spacing and padding throughout the interface."
        value={form.ui_density}
        onChange={(v) => setForm(f => ({ ...f, ui_density: v }))}
        options={[
          { value: 'compact', label: 'Compact', description: 'Dense, more on screen' },
          { value: 'comfortable', label: 'Comfortable', description: 'Balanced (default)' },
          { value: 'spacious', label: 'Spacious', description: 'Generous padding' },
        ]}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-primary">Appearance saved.</p>}

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving…' : 'Save Changes'}
      </Button>
    </div>
  );
}
