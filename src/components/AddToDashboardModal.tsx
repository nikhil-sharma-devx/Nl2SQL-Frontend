/**
 * AddToDashboardModal — save a chat result as a dashboard widget.
 *
 * Lets the user pick an existing dashboard or create a new one, then persists
 * the widget (SQL + chart config) via `addDashboardWidget`. This is the missing
 * link that made dashboards permanently empty.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDashboards,
  createDashboard,
  addDashboardWidget,
  handleApiError,
  type DashboardListResponse,
  type WidgetInput,
} from '../api/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { toast } from './ui/toast';
import { LayoutDashboard, Plus, Loader2, Check } from 'lucide-react';

interface AddToDashboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Seed widget payload (title, nl_prompt, sql, chart_type, chart_config). */
  widget: WidgetInput;
}

export default function AddToDashboardModal({ open, onOpenChange, widget }: AddToDashboardModalProps) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const { data, isLoading } = useQuery<DashboardListResponse>({
    queryKey: ['dashboards'],
    queryFn: () => getDashboards({ limit: 100, offset: 0 }),
    enabled: open,
  });

  const items = data?.items ?? [];
  // A typed new name always wins; otherwise use the selected dashboard.
  const willCreate = newName.trim().length > 0;
  const canSubmit = willCreate || !!selectedId;

  const addMutation = useMutation({
    mutationFn: async () => {
      let dashboardId = selectedId;
      if (willCreate || !dashboardId) {
        const created = await createDashboard({ name: newName.trim() || 'My Charts' });
        dashboardId = created.id;
      }
      return addDashboardWidget(dashboardId, widget);
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', d.id] });
      toast({ title: 'Added to dashboard', variant: 'success' });
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  const reset = () => {
    setSelectedId(null);
    setNewName('');
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent showClose onClose={close}>
        <DialogHeader>
          <DialogTitle>Add to dashboard</DialogTitle>
          <DialogDescription>
            Save “{widget.title || 'this result'}” as a live widget on a dashboard.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-1">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {items.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Existing dashboard
                </p>
                <div className="max-h-48 space-y-1 overflow-auto pr-1">
                  {items.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(d.id);
                        setNewName('');
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        selectedId === d.id && !willCreate
                          ? 'border-primary/50 bg-primary/10 text-foreground'
                          : 'border-border bg-background/40 text-foreground/80 hover:border-primary/30'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <LayoutDashboard className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{d.name}</span>
                      </span>
                      {selectedId === d.id && !willCreate && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {items.length > 0 ? 'Or create new' : 'Create a dashboard'}
              </p>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New dashboard name…"
                aria-label={items.length > 0 ? 'New dashboard name' : 'Dashboard name'}
                onKeyDown={(e) => e.key === 'Enter' && canSubmit && addMutation.mutate()}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={addMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => addMutation.mutate()} disabled={!canSubmit || addMutation.isPending}>
            {addMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : willCreate ? (
              <Plus className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {willCreate ? 'Create & add' : 'Add widget'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
