import { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { FormMessage } from '../../components/ui/form-message';
import InfoTip from '../../components/InfoTip';

function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary animate-fade-in">
      <Check className="h-3.5 w-3.5" /> Saved
    </span>
  );
}

type RadioGroupProps = {
  label: string;
  info?: string;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
};

function RadioGroup({ label, info, name, options, value, onChange }: RadioGroupProps) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {info && <InfoTip text={info} />}
      </Label>
      <div className="flex gap-3">
        {options.map(opt => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="accent-primary"
            />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function SqlStyleSettings() {
  const { settings, updateSettings } = useSettings();
  const [form, setForm] = useState({
    sql_keyword_case: settings.sql_keyword_case,
    sql_cte_pref: settings.sql_cte_pref,
    sql_alias_style: settings.sql_alias_style,
    sql_indent: settings.sql_indent,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setForm({
      sql_keyword_case: settings.sql_keyword_case,
      sql_cte_pref: settings.sql_cte_pref,
      sql_alias_style: settings.sql_alias_style,
      sql_indent: settings.sql_indent,
    });
  }, [settings]);

  const commit = async (next: typeof form) => {
    setForm(next);
    try {
      setError('');
      await updateSettings(next);
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1500);
    } catch {
      setError('Failed to save settings');
    }
  };

  return (
    <div className="space-y-5 max-w-lg">
      <RadioGroup
        label="Keyword Case"
        info="Controls whether SQL keywords like SELECT, FROM, WHERE are output in uppercase or lowercase. Uppercase is the conventional SQL style."
        name="keyword_case"
        options={[
          { value: 'upper', label: 'UPPER (SELECT, FROM…)' },
          { value: 'lower', label: 'lower (select, from…)' },
        ]}
        value={form.sql_keyword_case}
        onChange={(v) => commit({ ...form, sql_keyword_case: v as 'upper' | 'lower' })}
      />

      <RadioGroup
        label="CTE Preference"
        info="How the AI structures complex multi-step queries. CTEs (WITH ... AS) are more readable; subqueries are more compact and supported everywhere."
        name="cte_pref"
        options={[
          { value: 'cte', label: 'CTE (WITH …)' },
          { value: 'subquery', label: 'Subquery' },
        ]}
        value={form.sql_cte_pref}
        onChange={(v) => commit({ ...form, sql_cte_pref: v as 'cte' | 'subquery' })}
      />

      <RadioGroup
        label="Alias Style"
        info="Whether column or table aliases use the explicit AS keyword (SELECT col AS alias) or are written directly without it (SELECT col alias)."
        name="alias_style"
        options={[
          { value: 'as', label: 'Explicit AS keyword' },
          { value: 'implicit', label: 'Implicit (no AS)' },
        ]}
        value={form.sql_alias_style}
        onChange={(v) => commit({ ...form, sql_alias_style: v as 'as' | 'implicit' })}
      />

      <div className="space-y-1.5">
        <Label htmlFor="sql-indent">
          Indent Width
          <InfoTip text="Number of spaces used per indentation level in generated SQL. 2 is standard for most SQL formatters; 4 is common in some enterprise environments." />
        </Label>
        <Input
          id="sql-indent"
          type="number"
          min={1}
          max={8}
          value={form.sql_indent}
          onChange={(e) => setForm(f => ({ ...f, sql_indent: Number(e.target.value) }))}
          onBlur={() => commit(form)}
          className="w-24"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <FormMessage>{error}</FormMessage>
        <SavedBadge show={saved && !error} />
      </div>
    </div>
  );
}
