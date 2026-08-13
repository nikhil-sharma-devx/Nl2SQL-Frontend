import { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { FormMessage } from '../../components/ui/form-message';
import InfoTip from '../../components/InfoTip';

/** Small transient "Saved" indicator shown next to a field after an auto-save succeeds. */
function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary animate-fade-in">
      <Check className="h-3.5 w-3.5" /> Saved
    </span>
  );
}

export default function GeneralSettings() {
  const { settings, updateSettings } = useSettings();
  const [form, setForm] = useState({
    default_dialect: settings.default_dialect ?? '',
    max_result_rows: settings.max_result_rows,
    auto_execute: settings.auto_execute,
    default_model: settings.default_model ?? '',
  });

  useEffect(() => {
    setForm({
      default_dialect: settings.default_dialect ?? '',
      max_result_rows: settings.max_result_rows,
      auto_execute: settings.auto_execute,
      default_model: settings.default_model ?? '',
    });
  }, [settings]);

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const commit = async (next: typeof form) => {
    setForm(next);
    try {
      setError('');
      await updateSettings({
        default_dialect: next.default_dialect || null,
        max_result_rows: next.max_result_rows,
        auto_execute: next.auto_execute,
        default_model: next.default_model || null,
      });
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1500);
    } catch {
      setError('Failed to save settings');
    }
  };

  return (
    <div className="space-y-5 max-w-lg">
      <div className="space-y-1.5">
        <Label htmlFor="default-dialect">
          Default SQL Dialect
          <InfoTip text="The SQL dialect the AI targets when generating queries (e.g. postgres, mysql, bigquery). Leave blank to let the model choose based on context." />
        </Label>
        <Input
          id="default-dialect"
          value={form.default_dialect}
          onChange={(e) => setForm(f => ({ ...f, default_dialect: e.target.value }))}
          onBlur={() => commit(form)}
          placeholder="e.g. postgres, mysql, sqlite"
        />
        <p className="text-xs text-muted-foreground">Used when no dialect is specified per query.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="max-result-rows">
          Max Result Rows
          <InfoTip text="Maximum rows returned per query execution. Higher values can slow down the UI for large result sets. Default is 1000." />
        </Label>
        <Input
          id="max-result-rows"
          type="number"
          min={1}
          max={100000}
          value={form.max_result_rows}
          onChange={(e) => setForm(f => ({ ...f, max_result_rows: Number(e.target.value) }))}
          onBlur={() => commit(form)}
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          id="auto-exec"
          type="checkbox"
          checked={form.auto_execute}
          onChange={(e) => commit({ ...form, auto_execute: e.target.checked })}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <Label htmlFor="auto-exec">
          Auto-execute generated SQL
          <InfoTip text="When enabled, generated SQL is run immediately after being produced — no confirmation step. Disable to review SQL before executing." />
        </Label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="default-model">
          Default Model
          <InfoTip text="The AI model used for SQL generation. Leave blank to use the model currently selected in the session switcher or the server default." />
        </Label>
        <Input
          id="default-model"
          value={form.default_model}
          onChange={(e) => setForm(f => ({ ...f, default_model: e.target.value }))}
          onBlur={() => commit(form)}
          placeholder="e.g. llama-3.3-70b-versatile"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <FormMessage>{error}</FormMessage>
        <SavedBadge show={saved && !error} />
      </div>
    </div>
  );
}
