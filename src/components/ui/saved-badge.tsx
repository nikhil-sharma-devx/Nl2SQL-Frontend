import { Check } from 'lucide-react';

/** Shared "Saved" confirmation for auto-saving settings forms — every settings
 * panel shows the same transient badge after a successful field commit. */
function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary animate-fade-in">
      <Check className="h-3.5 w-3.5" /> Saved
    </span>
  );
}

export { SavedBadge };
