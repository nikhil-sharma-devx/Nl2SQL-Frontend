import { useState, useEffect } from 'react';
import { Database, ChevronDown, Check } from 'lucide-react';
import { getDatabaseConfig, updateDatabaseConfig, DatabaseConfig } from '../api/client';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const DatabaseSelector = () => {
  const [config, setConfig] = useState<DatabaseConfig | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await getDatabaseConfig();
      setConfig(data);
    } catch (error) {
      console.error('Failed to load database config:', error);
    }
  };

  const handleSelect = async (url: string) => {
    if (config?.database_url === url) {
      return;
    }
    setIsUpdating(true);
    try {
      await updateDatabaseConfig(url);
      setConfig((prev) => (prev ? { ...prev, database_url: url } : null));
    } catch (error) {
      console.error('Failed to update database config:', error);
      alert('Failed to connect to the selected database.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!config || !config.available_databases || Object.keys(config.available_databases).length <= 1) {
    // Hide if no multiple databases configured
    return null;
  }

  const currentDbName =
    Object.entries(config.available_databases).find(([, url]) => url === config.database_url)?.[0] || 'Unknown Database';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isUpdating}
        className="group flex items-center gap-2 rounded-xl border border-border bg-foreground/[0.03] px-3.5 py-2 transition-all hover:border-border hover:bg-foreground/[0.06] disabled:opacity-50"
      >
        <Database className="h-4 w-4 text-primary" />
        <div className="flex flex-col items-start leading-none">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Data Source</span>
          <span className="mt-0.5 text-xs font-semibold text-foreground">{isUpdating ? 'Connecting…' : currentDbName}</span>
        </div>
        <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground/80" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Databases</DropdownMenuLabel>
        {Object.entries(config.available_databases).map(([name, url]) => {
          const isSelected = config.database_url === url;
          return (
            <DropdownMenuItem
              key={name}
              onClick={() => handleSelect(url)}
              className={cn(isSelected && 'bg-primary/10 text-primary')}
            >
              <span className="flex items-center gap-2">
                <Database className={cn('h-3.5 w-3.5', isSelected ? 'text-primary' : 'text-muted-foreground/80')} />
                {name}
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
