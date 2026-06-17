import { useState, useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export default function GeneralSettings() {
  const { settings, updateSettings, isSaving } = useSettings();
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

  const handleSave = async () => {
    try {
      setError('');
      await updateSettings({
        default_dialect: form.default_dialect || null,
        max_result_rows: form.max_result_rows,
        auto_execute: form.auto_execute,
        default_model: form.default_model || null,
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
        <Label>Default SQL Dialect</Label>
        <Input
          value={form.default_dialect}
          onChange={(e) => setForm(f => ({ ...f, default_dialect: e.target.value }))}
          placeholder="e.g. postgres, mysql, sqlite"
        />
        <p className="text-xs text-muted-foreground">Used when no dialect is specified per query.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Max Result Rows</Label>
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
        <Label htmlFor="auto-exec">Auto-execute generated SQL</Label>
      </div>

      <div className="space-y-1.5">
        <Label>Default Model</Label>
        <Input
          value={form.default_model}
          onChange={(e) => setForm(f => ({ ...f, default_model: e.target.value }))}
          placeholder="e.g. llama-3.3-70b-versatile"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-primary">Settings saved.</p>}

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving…' : 'Save Changes'}
      </Button>
    </div>
  );
}
