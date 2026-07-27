import { MoreVertical, type LucideIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface ActionItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * Overflow "More" menu for secondary per-item actions (chat-app style: 2-3
 * primary actions stay inline where they already are; everything else moves
 * here). Built entirely from the existing `ui/dropdown-menu` primitives — no
 * new visual language, no new dependency.
 */
export function ItemActionsMenu({ actions, className }: { actions: ActionItem[]; className?: string }) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu className={className}>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
        title="More actions"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {actions.map(({ key, label, icon: Icon, onClick, destructive, disabled }) => (
          <DropdownMenuItem
            key={key}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className={cn(destructive && 'text-destructive hover:bg-destructive/10 hover:text-destructive')}
          >
            <span className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
