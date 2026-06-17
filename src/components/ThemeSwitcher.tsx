import { Palette, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const ThemeSwitcher = () => {
  const { theme, setTheme, themes } = useTheme();
  const active = themes.find((t) => t.id === theme) ?? themes[0];

  return (
    <DropdownMenu className="w-full">
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-foreground/[0.02] px-2.5 py-2 text-left transition-colors hover:bg-foreground/[0.05]">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border" style={{ background: active.swatch[0] }}>
          <span className="h-3 w-3 rounded-full" style={{ background: active.swatch[1] }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
            <Palette className="h-3 w-3 text-muted-foreground" />
            {active.label}
          </span>
          <span className="block truncate font-mono text-[10px] text-muted-foreground">Theme · {active.hint}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        {themes.map((t) => (
          <DropdownMenuItem key={t.id} onClick={() => setTheme(t.id)} className={cn(theme === t.id && 'bg-primary/10 text-foreground')}>
            <span className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border" style={{ background: t.swatch[0] }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.swatch[1] }} />
              </span>
              <span className="flex flex-col">
                <span className="text-xs font-medium text-foreground">{t.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{t.hint}</span>
              </span>
            </span>
            {theme === t.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeSwitcher;
