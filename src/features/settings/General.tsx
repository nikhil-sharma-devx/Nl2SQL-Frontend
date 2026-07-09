import { useState, useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { cn } from '@/lib/utils';
import InfoTip from '../../components/InfoTip';

function RadioGroup<T extends string>({
  label,
  info,
  value,
  options,
  onChange,
}: {
  label: string;
  info?: string;
  value: T;
  options: { value: T; label: string; description?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {info && <InfoTip text={info} />}
      </Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
              value === opt.value
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-border bg-background/50 text-muted-foreground hover:text-foreground hover:border-border/80',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {options.find(o => o.value === value)?.description && (
        <p className="text-xs text-muted-foreground">{options.find(o => o.value === value)?.description}</p>
      )}
    </div>
  );
}

export default function GeneralSettings() {
  const { settings, updateSettings, isSaving } = useSettings();
  const [form, setForm] = useState({
    default_dialect: settings.default_dialect ?? '',
    max_result_rows: settings.max_result_rows,
    auto_execute: settings.auto_execute,
    default_model: settings.default_model ?? '',
    font_size: settings.font_size,
    ui_density: settings.ui_density,
  });

  useEffect(() => {
    setForm({
      default_dialect: settings.default_dialect ?? '',
      max_result_rows: settings.max_result_rows,
      auto_execute: settings.auto_execute,
      default_model: settings.default_model ?? '',
      font_size: settings.font_size,
      ui_density: settings.ui_density,
    });
  }, [settings]);

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    try {
      setError('');
      await updateSettings({
        default_dialect: form.default_dialect || null,
        max_result_rows: form.max_result_rows,
        auto_execute: form.auto_execute,
        default_model: form.default_model || null,
        font_size: form.font_size,
        ui_density: form.ui_density,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save settings');
    }
  };

  return (
    <div className="space-y-5 max-w-lg">
      <div className="space-y-1.5">
        <Label>
          Default SQL Dialect
          <InfoTip text="The SQL dialect the AI targets when generating queries (e.g. postgres, mysql, bigquery). Leave blank to let the model choose based on context." />
        </Label>
        <Input
          value={form.default_dialect}
          onChange={(e) => setForm(f => ({ ...f, default_dialect: e.target.value }))}
          placeholder="e.g. postgres, mysql, sqlite"
        />
        <p className="text-xs text-muted-foreground">Used when no dialect is specified per query.</p>
      </div>

      <div className="space-y-1.5">
        <Label>
          Max Result Rows
          <InfoTip text="Maximum rows returned per query execution. Higher values can slow down the UI for large result sets. Default is 1000." />
        </Label>
        <Input
          type="number"
          min={1}
          max={100000}
          value={form.max_result_rows}
          onChange={(e) => setForm(f => ({ ...f, max_result_rows: Number(e.target.value) }))}
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          id="auto-exec"
          type="checkbox"
          checked={form.auto_execute}
          onChange={(e) => setForm(f => ({ ...f, auto_execute: e.target.checked }))}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <Label htmlFor="auto-exec">
          Auto-execute generated SQL
          <InfoTip text="When enabled, generated SQL is run immediately after being produced — no confirmation step. Disable to review SQL before executing." />
        </Label>
      </div>

      <div className="space-y-1.5">
        <Label>
          Default Model
          <InfoTip text="The AI model used for SQL generation. Leave blank to use the model currently selected in the session switcher or the server default." />
        </Label>
        <Input
          value={form.default_model}
          onChange={(e) => setForm(f => ({ ...f, default_model: e.target.value }))}
          placeholder="e.g. llama-3.3-70b-versatile"
        />
      </div>

      <div className="h-px bg-border/50" />

      <RadioGroup
        label="Font Size"
        info="Sets the base font size for the entire app. Small = 13px, Medium = 16px (default), Large = 18px. All spacing scales with it since Tailwind uses rem."
        value={form.font_size}
        onChange={(v) => setForm(f => ({ ...f, font_size: v }))}
        options={[
          { value: 'small', label: 'Small', description: 'Compact text (13px) — fits more content' },
          { value: 'medium', label: 'Medium', description: 'Default (16px) — balanced readability' },
          { value: 'large', label: 'Large', description: 'Easier to read (18px) — ideal for high-DPI' },
        ]}
      />

      <RadioGroup
        label="UI Density"
        info="Scales all padding, margins, and gaps across the app. Compact = tighter layout showing more items. Spacious = more breathing room, easier to click."
        value={form.ui_density}
        onChange={(v) => setForm(f => ({ ...f, ui_density: v }))}
        options={[
          { value: 'compact', label: 'Compact', description: 'Tighter spacing — more content visible' },
          { value: 'comfortable', label: 'Comfortable', description: 'Balanced spacing (default)' },
          { value: 'spacious', label: 'Spacious', description: 'Generous padding — easier to navigate' },
        ]}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-primary">Settings saved.</p>}

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving…' : 'Save Changes'}
      </Button>
    </div>
  );
}
