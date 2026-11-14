import { useTranslations } from 'next-intl';
import type { ConfiguredTool } from '@/lib/api/endpoints/agentTools';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import { integrationOf } from '@/utils/integrationLabels';
import type { ToolSourceEntry } from '../types/toolSource';
import { nameInIntegration } from '../utils/toolCatalog';

// A configured tool as the agent editor shows it.
export interface AgentToolView {
  tool: ConfiguredTool;
  // The label without the integration's name, which `group` carries.
  name: string;
  // The integration and its credential, or the team's own tools for a tool of a source.
  group: string;
  integration: Pick<IntegrationMeta, 'label' | 'kind' | 'icon'>;
  // The full label, the integration and the credential, which a search also matches; the
  // group of a tool of a source names neither.
  search: string;
  // Why no agent gets it, when none does.
  warning?: string;
}

export function useAgentToolViews(
  tools: ConfiguredTool[],
  catalog: IntegrationMeta[],
  sources: ToolSourceEntry[],
): AgentToolView[] {
  const t = useTranslations('teams.tools');
  return tools.map((tool) => {
    const integration = integrationOf(catalog, tool.integrationKey);
    const credential =
      tool.credentialLabel ??
      (tool.credentialId != null ? t('credentialFallback', { id: tool.credentialId }) : null);
    const locked = sources.some((one) => one.kind === 'locked' && one.key === tool.source);
    return {
      tool,
      name: tool.source ? tool.label : nameInIntegration(tool.label, integration.label),
      group: tool.source
        ? t('ownTools')
        : [integration.label, credential].filter(Boolean).join(' · '),
      integration,
      search: [tool.label, integration.label, credential].filter(Boolean).join(' '),
      warning: tool.supported ? undefined : t(locked ? 'locked' : 'unavailable'),
    };
  });
}
