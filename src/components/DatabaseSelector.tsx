import { useState } from 'react';
import { Database, ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useConnections } from '../context/ConnectionContext';
import { handleApiError } from '../api/client';
import { toast } from './ui/toast';

/**
 * Active-connection switcher shown in the query toolbar. Lists the user's
 * database connections and switches the active one server-side; schema/graph/
 * chat then follow the new connection automatically (ConnectionContext
 * invalidates the dependent queries on select).
 */
const DatabaseSelector = () => {
  const { connections, activeConnection, select } = useConnections();
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Nothing to switch between until the user has at least one connection.
  if (connections.length === 0) {
    return null;
  }

  const handleSelect = async (id: string) => {
    if (activeConnection?.connection_id === id) return;
    setSwitchingId(id);
    try {
      await select(id);
    } catch (error) {
      toast({ title: handleApiError(error), variant: 'error' });
    } finally {
      setSwitchingId(null);
    }
  };

  const currentName = activeConnection?.name ?? 'Select connection';
  const isSwitching = switchingId !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isSwitching}
        className="group flex items-center gap-2 rounded-xl border border-border bg-foreground/[0.03] px-3.5 py-2 transition-all hover:border-border hover:bg-foreground/[0.06] disabled:opacity-50"
      >
        <Database className="h-4 w-4 text-primary" />
        <div className="flex flex-col items-start leading-none">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
            Data Source
          </span>
          <span className="mt-0.5 text-xs font-semibold text-foreground">
            {isSwitching ? 'Switching…' : currentName}
          </span>
        </div>
        <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground/80" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Connections</DropdownMenuLabel>
        {connections.map((conn) => {
          const isSelected = conn.connection_id === activeConnection?.connection_id;
          return (
            <DropdownMenuItem
              key={conn.connection_id}
              onClick={() => handleSelect(conn.connection_id)}
              className={cn(isSelected && 'bg-primary/10 text-primary')}
            >
              <span className="flex items-center gap-2">
                <Database
                  className={cn('h-3.5 w-3.5', isSelected ? 'text-primary' : 'text-muted-foreground/80')}
                />
                <span className="flex flex-col">
                  <span>{conn.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {conn.db_type}
                  </span>
                </span>
              </span>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DatabaseSelector;
