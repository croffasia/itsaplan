import { useMemo, useState } from 'react';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import Modal from '@/components/common/overlay/Modal';
import { ToolPicker } from './ToolPicker';
import { ToolCredentialStep } from './ToolCredentialStep';
import { useMcpServerToolsQuery } from '@/services/integrations.service';
import { useTranslations } from 'next-intl';

// One catalog tool tagged with the integration it belongs to.
export interface ToolOption {
  id: string;
  toolKey: string;
  label: string;
  description: string;
  // OAuth scopes the credential's token must carry for this tool (may be empty).
  scopes: string[];
  integrationKey: string;
  integrationLabel: string;
  credentialId?: number;
}

// Add configured tools in two steps: pick one or more tools of the same integration from
// the searchable, grouped catalog (ToolPicker), then pick a credential of that
// integration to run them on (ToolCredentialStep).
export function ToolConfigDialog({
  teamId,
  teamName,
  catalog,
  onClose,
}: {
  teamId: number;
  teamName: string;
  catalog: IntegrationMeta[];
  onClose: () => void;
}) {
  const t = useTranslations('teams.tools');
  const mcpServers = useMcpServerToolsQuery(teamId);
  const toolOptions = useMemo<ToolOption[]>(
    () => [
      ...catalog
        .filter((i) => i.kind === 'tool')
        .flatMap((i) =>
          i.tools.map((tool) => ({
            id: `${i.key}/${tool.key}`,
            toolKey: tool.key,
            label: tool.label,
            description: tool.description,
            scopes: tool.scopes ?? [],
            integrationKey: i.key,
            integrationLabel: i.label,
          })),
        ),
      ...mcpServers.flatMap(({ server, tools }) =>
        tools.map((tool) => ({
          id: `mcp-${server.id}/${tool.key}`,
          toolKey: tool.key,
          label: tool.label,
          description: tool.description,
          scopes: [],
          integrationKey: `mcp-${server.id}`,
          integrationLabel: server.label ?? `MCP server #${server.id}`,
          credentialId: server.id,
        })),
      ),
    ],
    [catalog, mcpServers],
  );

  const [tools, setTools] = useState<ToolOption[]>([]);

  return (
    <Modal title={t('add')} scope={teamName} onClose={onClose} wide>
      {tools.length > 0 ? (
        <ToolCredentialStep
          teamId={teamId}
          tools={tools}
          onBack={() => setTools([])}
          onDone={onClose}
        />
      ) : (
        <div className="space-y-3">
          {mcpServers
            .filter((m) => m.error)
            .map(({ server, error }) => (
              <p key={server.id} className="text-xs text-muted-foreground">
                {t('mcpUnavailable', {
                  server: server.label ?? `MCP server #${server.id}`,
                  reason: error ?? '',
                })}
              </p>
            ))}
          <ToolPicker options={toolOptions} onSubmit={setTools} />
        </div>
      )}
    </Modal>
  );
}
