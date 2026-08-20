import type { ReactNode } from 'react';
import { Bot, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListLoading, QueryState } from '@/components/shared/QueryState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useLlmConfig, useLlmProviders } from '@/hooks/queries/useLlm';
import type { LlmConfig, LlmProviderSummary } from '@/types';

const providerLabels: Record<string, string> = {
  local_deterministic: 'Local deterministic',
  agno_local: 'Agno local',
  openai: 'OpenAI',
  azure_openai: 'Azure OpenAI',
  anthropic: 'Anthropic',
};

export function LlmCatalogSection() {
  const configQuery = useLlmConfig();
  const providersQuery = useLlmProviders();
  const config = configQuery.data;
  const providers = providersQuery.data ?? [];

  const refresh = () => {
    void configQuery.refetch();
    void providersQuery.refetch();
  };

  return (
    <section className="rounded-lg border bg-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="h-4 w-4 text-primary" />
            Catalogo LLM
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Visao sanitizada do backend para governanca de providers, sem secrets, prompts brutos ou outputs brutos.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={configQuery.isFetching || providersQuery.isFetching}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Atualizar
        </Button>
      </div>

      <QueryState
        query={configQuery}
        loading={<div className="p-4"><ListLoading rows={3} /></div>}
        errorTitle="Nao foi possivel carregar a configuracao LLM"
        errorDescription="Tente novamente em instantes. A configuracao e lida apenas do backend."
      >
        <QueryState
          query={providersQuery}
          isEmpty={providers.length === 0}
          loading={<div className="p-4"><ListLoading rows={4} /></div>}
          emptyIcon={<Bot className="h-6 w-6" />}
          emptyTitle="Nenhum provider LLM cadastrado"
          emptyDescription="O catalogo sanitizado de providers aparecera aqui quando o backend retornar dados."
          errorTitle="Nao foi possivel carregar providers LLM"
          errorDescription="Tente novamente em instantes. Nenhum provider externo e chamado pelo frontend."
        >
          <LlmCatalogContent config={config} providers={providers} />
        </QueryState>
      </QueryState>
    </section>
  );
}

function LlmCatalogContent({ config, providers }: { config?: LlmConfig; providers: LlmProviderSummary[] }) {
  const currentProvider = providers.find((provider) => provider.current);
  const defaultProvider = config?.defaultProvider ?? currentProvider?.provider ?? 'local_deterministic';

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Provider atual"
          value={currentProvider?.provider ?? defaultProvider}
          detail={`Default: ${defaultProvider}`}
          mono
        />
        <SummaryTile
          icon={<SlidersHorizontal className="h-4 w-4" />}
          label="Catalogo externo"
          value={config?.providersEnabled ? 'Habilitado' : 'Desligado'}
          detail="Providers visiveis somente via backend"
        />
        <SummaryTile
          label="Execução LLM global"
          value={config?.executionEnabled ? 'Habilitada' : 'Bloqueada'}
          detail={`Timeout: ${config?.providerTimeoutMs ?? 30000}ms`}
        />
        <SummaryTile
          label="Dados sensiveis"
          value="Nao exibidos"
          detail={`Prompt bruto: ${blockedText(config?.storeRawPrompts)} - Output bruto: ${blockedText(config?.storeRawOutputs)}`}
        />
      </div>

      <div className="rounded-md border">
        <div className="border-b px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Providers retornados por /llm/providers</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Provider</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Enabled</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Configured</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Capacidade de execução</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Modelo</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Health</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <ProviderRow key={provider.provider} provider={provider} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
        <p>Input preview: {config?.maxInputPreviewChars ?? 500} chars</p>
        <p>Output preview: {config?.maxOutputPreviewChars ?? 800} chars</p>
        <p>OpenAI aparece somente como provider governado pelo backend.</p>
      </div>
    </div>
  );
}

function ProviderRow({ provider }: { provider: LlmProviderSummary }) {
  const model = provider.capabilities.defaultModel ?? provider.capabilities.models[0];

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px]">{provider.provider}</Badge>
          {provider.current && <Badge variant="secondary" className="text-[10px]">Atual</Badge>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{providerLabels[provider.provider] ?? provider.provider}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <StatusBadge status={provider.health.status} />
      </td>
      <td className="px-3 py-3 align-top">{booleanBadge(provider.capabilities.enabled)}</td>
      <td className="px-3 py-3 align-top">{booleanBadge(provider.capabilities.configured)}</td>
      <td className="px-3 py-3 align-top">{executionBadge(provider.capabilities.executionEnabled)}</td>
      <td className="px-3 py-3 align-top">
        <span className="font-mono text-xs">{model ?? 'nao configurado'}</span>
        {provider.capabilities.models.length > 1 && (
          <p className="mt-1 text-xs text-muted-foreground">+{provider.capabilities.models.length - 1} modelos</p>
        )}
      </td>
      <td className="max-w-sm px-3 py-3 align-top">
        <p className="text-xs text-muted-foreground">Status sanitizado pelo backend</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{formatCheckedAt(provider.health.checkedAt)}</p>
      </td>
    </tr>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  detail,
  mono = false,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  detail: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`mt-2 text-sm font-semibold ${mono ? 'font-mono' : ''}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function booleanBadge(value: boolean) {
  return (
    <Badge variant={value ? 'secondary' : 'outline'} className="text-[10px]">
      {value ? 'Sim' : 'Nao'}
    </Badge>
  );
}

function executionBadge(value: boolean) {
  return (
    <Badge variant={value ? 'secondary' : 'outline'} className="text-[10px]">
      {value ? 'Habilitada' : 'Bloqueada'}
    </Badge>
  );
}

function blockedText(value?: boolean) {
  return value ? 'armazenado no backend' : 'bloqueado';
}

function formatCheckedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
