import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Check, Cpu, Sparkles } from 'lucide-react';
import { getLLMConfig, getAvailableModels, updateLLMConfig, handleApiError } from '../api/client';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const ModelSwitcher = () => {
  const queryClient = useQueryClient();

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['llmConfig'],
    queryFn: getLLMConfig,
  });

  const { data: models, isLoading: modelsLoading } = useQuery({
    queryKey: ['availableModels'],
    queryFn: getAvailableModels,
  });

  const updateMutation = useMutation({
    mutationFn: updateLLMConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmConfig'] });
    },
  });

  const handleProviderChange = (provider: string) => {
    if (provider !== config?.provider) {
      const availableModels = models?.[provider] || [];
      const defaultModel = availableModels[0] || '';
      updateMutation.mutate({ provider, model: defaultModel });
    }
  };

  const handleModelChange = (model: string) => {
    if (model !== config?.model && config?.provider) {
      updateMutation.mutate({ provider: config.provider, model });
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return 'bg-primary';
      case 'groq':
        return 'bg-amber-400';
      case 'anthropic':
        return 'bg-orange-500';
      case 'gemini':
        return 'bg-blue-500';
      default:
        return 'bg-cyan-400';
    }
  };

  if (configLoading || modelsLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-600" />
        Loading…
      </div>
    );
  }

  const availableProviders = config?.available_providers || [];
  const currentModels = models?.[config?.provider || ''] || [];

  return (
    <div className="flex items-center gap-2">
      {/* Provider Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 rounded-lg border border-border bg-foreground/[0.03] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/[0.06] disabled:opacity-50"
        >
          <span className={cn('h-2 w-2 rounded-full', getProviderColor(config?.provider || ''))} />
          <span className="capitalize">{config?.provider || 'Select'}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground/80" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>Provider</DropdownMenuLabel>
          {availableProviders.map((provider) => (
            <DropdownMenuItem key={provider} onClick={() => handleProviderChange(provider)}>
              <span className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', getProviderColor(provider))} />
                <span className="capitalize">{provider}</span>
              </span>
              {config?.provider === provider && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Model Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 rounded-lg border border-border bg-foreground/[0.03] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/[0.06] disabled:opacity-50"
        >
          <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="max-w-[150px] truncate font-mono text-xs">{config?.model || 'Select Model'}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground/80" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Model</DropdownMenuLabel>
          {currentModels.map((model) => (
            <DropdownMenuItem key={model} onClick={() => handleModelChange(model)}>
              <span className="truncate font-mono text-xs">{model}</span>
              {config?.model === model && <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {updateMutation.isPending && <Sparkles className="h-4 w-4 animate-pulse text-primary" />}

      {updateMutation.isError && (
        <span className="text-xs text-rose-400">{handleApiError(updateMutation.error)}</span>
      )}
    </div>
  );
};

export default ModelSwitcher;
