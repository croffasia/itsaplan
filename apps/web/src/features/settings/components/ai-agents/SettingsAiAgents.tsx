import { useState } from 'react';
import type { AiAgent, ProjectDetail } from '@/lib/api';
import {
  useAiAgentsQuery,
  useDeleteAiAgent,
  useRegenerateAiAgentKey,
} from '@/services/aiAgents.service';
import { useIntegrationCatalogQuery } from '@/services/integrations.service';
import { AI_AGENTS_SECTION } from '@/utils/settingsSections';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { SettingsListEmpty } from '../crud/SettingsListEmpty';
import { SettingsAiAgentRow } from './SettingsAiAgentRow';
import AgentKeyRevealModal from './AgentKeyRevealModal';
import { SettingsAiAgentSheet } from './SettingsAiAgentSheet';
import { SettingsAiAgentRunsSheet } from './SettingsAiAgentRunsSheet';
import { integrationLabel } from '../../utils/integrationLabels';

const section = AI_AGENTS_SECTION;

// Project settings tab for AI agents: bot users that issues can be delegated to.
// An external agent is driven through the API; an internal agent runs on the
// built-in runtime and carries provider/model/instructions/tools. Creating and
// editing happen in the same full-width sheet; creating an external agent reveals
// its key once, inline, then stays open to keep editing. Regenerating a key (an
// existing external agent only) reveals the new plaintext secret once.
export default function SettingsAiAgents({ project }: { project: ProjectDetail }) {
  const projectKey = project.project.key;
  const agentsQuery = useAiAgentsQuery(projectKey);
  const agents = agentsQuery.data ?? [];
  const deleteAgent = useDeleteAiAgent(projectKey);
  const regenerateKey = useRegenerateAiAgentKey(projectKey);
  // The integration catalog maps a provider key to a readable label for the meta row.
  const catalog = useIntegrationCatalogQuery(projectKey).data ?? [];

  // The open sheet: null means closed, agentId null means create, a set id means edit
  // that agent. Held in a single object so `null` distinguishes closed from create.
  const [sheet, setSheet] = useState<{ agentId: number | null } | null>(null);
  // The agent whose run history sidebar is open.
  const [runsAgent, setRunsAgent] = useState<AiAgent | null>(null);
  const [deleting, setDeleting] = useState<AiAgent | null>(null);
  // The agent pending a key regeneration (awaiting confirmation).
  const [regenerating, setRegenerating] = useState<AiAgent | null>(null);
  // The plaintext key from a regenerate, revealed once.
  const [regeneratedKey, setRegeneratedKey] = useState<string | null>(null);

  const sheetAgent =
    sheet?.agentId != null ? (agents.find((a) => a.id === sheet.agentId) ?? null) : null;

  async function regenerate(agent: AiAgent) {
    const res = await regenerateKey.mutateAsync(agent.id);
    setRegeneratedKey(res.apiKey);
  }

  return (
    <>
      {agents.length === 0 ? (
        <SettingsListEmpty
          icon={section.icon}
          title="No agents yet"
          description="Add a bot user you can delegate issues to, driven through the API or by the built-in runtime."
        />
      ) : (
        <div className="space-y-4">
          <Table className="min-w-[1000px] table-fixed">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[18%]" />
              <col className="w-[42%]" />
              <col className="w-[14%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground">Agent</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Triggers
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Configuration
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((a) => (
                <SettingsAiAgentRow
                  key={a.id}
                  agent={a}
                  providerLabel={(key: string) => integrationLabel(catalog, key)}
                  onChat={() => setSheet({ agentId: a.id })}
                  onRuns={() => setRunsAgent(a)}
                  onRegenerate={() => setRegenerating(a)}
                  onEdit={() => setSheet({ agentId: a.id })}
                  onDelete={() => setDeleting(a)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <SettingsAiAgentSheet
        projectKey={projectKey}
        open={sheet != null}
        agent={sheetAgent}
        onClose={() => setSheet(null)}
      />

      <SettingsAiAgentRunsSheet
        projectKey={projectKey}
        agent={runsAgent}
        onClose={() => setRunsAgent(null)}
      />

      {regenerating && (
        <SettingsConfirmDeleteDialog
          title="Regenerate API key"
          confirmLabel="Regenerate key"
          message={
            <>
              A new key will be issued for <span className="font-medium">{regenerating.name}</span>{' '}
              and the current one will stop working immediately. Every existing connection using it
              will break until it is updated with the new key.
            </>
          }
          onClose={() => setRegenerating(null)}
          onConfirm={async () => {
            const agent = regenerating;
            setRegenerating(null);
            await regenerate(agent);
          }}
        />
      )}

      {regeneratedKey !== null && (
        <AgentKeyRevealModal
          title="Key regenerated"
          apiKey={regeneratedKey}
          onClose={() => setRegeneratedKey(null)}
        />
      )}

      {deleting && (
        <SettingsConfirmDeleteDialog
          title="Delete agent"
          confirmLabel="Delete agent"
          message={
            <>
              <span className="font-medium">{deleting.name}</span> and its API key will be removed,
              and it will be cleared from any issues it was assigned or delegated to. This cannot be
              undone.
            </>
          }
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteAgent.mutateAsync(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}
