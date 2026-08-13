import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  /** Compact drops the dashed frame and vertical padding for use inside an already-bordered panel (e.g. a sidebar list). */
  compact?: boolean;
}

/**
 * The one empty-state shape for the whole app (audit #9). Every "nothing here yet"
 * moment gets the same icon-tile + title + one-line teach copy + optional action,
 * so a first-time user learns the interface's vocabulary once and reuses it everywhere.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center",
        compact ? "gap-2 p-6" : "gap-1 py-16 px-6",
        className,
      )}
    >
      <div
        className={cn(
          "mb-3 flex items-center justify-center rounded-2xl border border-primary/25 bg-primary/10",
          compact ? "h-10 w-10" : "h-14 w-14",
        )}
        aria-hidden="true"
      >
        <Icon className={cn("text-primary", compact ? "h-5 w-5" : "h-7 w-7")} />
      </div>
      <p className="font-display font-semibold text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button size={compact ? "sm" : "default"} onClick={action.onClick}>
              {action.icon && <action.icon className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" size={compact ? "sm" : "default"} onClick={secondaryAction.onClick}>
              {secondaryAction.icon && <secondaryAction.icon className="h-4 w-4" />}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export { EmptyState };
