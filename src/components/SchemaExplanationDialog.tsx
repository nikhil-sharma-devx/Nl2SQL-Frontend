import { useQuery } from '@tanstack/react-query';
import { Loader2, Sparkles, AlertCircle, Database } from 'lucide-react';
import { getSchemaExplanation, handleApiError, type SchemaExplanation } from '../api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface SchemaExplanationDialogProps {
  /** Table to explain. When null the dialog is closed. */
  table: string | null;
  /** Optional column to focus the explanation on. */
  column?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * RAG-powered schema explanation shown when a user clicks a table/column.
 *
 * Fetches ``GET /schema/explain`` via TanStack Query with a stable key
 * (``['schema-explain', table, column]``) so repeated opens are served from the
 * client cache; the backend additionally caches the generated explanation.
 * Reuses the Dialog primitive (no Popover primitive exists in the design system).
 */
export function SchemaExplanationDialog({
  table,
  column,
  open,
  onOpenChange,
}: SchemaExplanationDialogProps) {
  const { data, isLoading, isError, error } = useQuery<SchemaExplanation>({
    queryKey: ['schema-explain', table, column ?? null],
    queryFn: () => getSchemaExplanation(table as string, column),
    enabled: open && !!table,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  const title = column ? `${table}.${column}` : table;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[80vh] overflow-y-auto custom-scrollbar"
        showClose
        onClose={() => onOpenChange(false)}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-success-text" />
            <span className="font-mono">{title}</span>
            {data?.cached && (
              <Badge variant="secondary" className="ml-1">
                cached
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating explanation…
          </div>
        ) : isError ? (
          <div className="flex items-start gap-2 py-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{handleApiError(error)}</span>
          </div>
        ) : data ? (
          <div className="space-y-4 text-sm">
            <Section title="Description">{data.description || '—'}</Section>
            <Section title="Business meaning">{data.business_meaning || '—'}</Section>
            <ListSection title="Relationships" items={data.relationships} />
            <Section title="Example usage">{data.example_usage || '—'}</Section>
            <ListSection title="Common joins" items={data.common_joins} mono />
            <div className="space-y-1.5">
              <SectionLabel>Example SQL</SectionLabel>
              <pre className="overflow-x-auto custom-scrollbar rounded-lg border border-border bg-background/60 p-3 font-mono text-xs text-foreground">
                {data.example_sql || '—'}
              </pre>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <SectionLabel>{title}</SectionLabel>
      <p className="text-foreground/90">{children}</p>
    </div>
  );
}

function ListSection({
  title,
  items,
  mono = false,
}: {
  title: string;
  items?: string[] | null;
  mono?: boolean;
}) {
  const list = items ?? [];
  return (
    <div className="space-y-1.5">
      <SectionLabel>
        <Database className="h-3 w-3" /> {title}
      </SectionLabel>
      {list.length === 0 ? (
        <p className="text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-1">
          {list.map((item, i) => (
            <li
              key={i}
              className={
                mono
                  ? 'rounded border border-border/60 bg-background/40 px-2 py-1 font-mono text-xs text-foreground/85'
                  : 'text-foreground/90'
              }
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
