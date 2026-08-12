import { useState } from 'react';
import type { AiAgent, ProjectDetail } from '@/lib/api';
import {
  useAiAgentsQuery,
  useDeleteAiAgent,
  useRegenerateAiAgentKey,
} from '@/services/aiAgents.service';
import { useIntegrationCatalogQuery } from '@/services/integrations.service';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { SettingsAiAgentRow } from './SettingsAiAgentRow';
import AgentKeyRevealModal from './AgentKeyRevealModal';
import { SettingsAiAgentSheet } from './SettingsAiAgentSheet';
import { SettingsAiAgentRunsSheet } from './SettingsAiAgentRunsSheet';
import { integrationLabel } from '../../utils/integrationLabels';
import { useTranslations } from 'next-intl';

// Project settings tab for AI agents: bot users that issues can be delegated to.
// An external agent is driven through the API; an internal agent runs on the
// built-in runtime and carries provider/model/instructions/tools. Creating and
// editing happen in the same full-width sheet; creating an external agent reveals
// its key once, inline, then stays open to keep editing. Regenerating a key (an
// existing external agent only) reveals the new plaintext secret once.
export default function SettingsAiAgents({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.agents');
  const tCommon = useTranslations('common');
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
      {agentsQuery.isPending ? (
        <ListSkeleton rows={3} rowClassName="h-12" />
      ) : agents.length === 0 ? (
        <EmptyState title={t('empty')} description={t('emptyHint')} />
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
                <TableHead className="text-xs font-medium text-muted-foreground">
                  {t('agent')}
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  {t('columns.triggers')}
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  {t('columns.configuration')}
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">
                  {tCommon('actions')}
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
          title={t('regenerateTitle')}
          confirmLabel={t('regenerateConfirm')}
          message={t.rich('regenerateMessage', {
            name: regenerating.name,
            v: (chunks) => <span className="font-medium">{chunks}</span>,
          })}
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
          title={t('keyRegenerated')}
          apiKey={regeneratedKey}
          onClose={() => setRegeneratedKey(null)}
        />
      )}

      {deleting && (
        <SettingsConfirmDeleteDialog
          title={t('delete')}
          confirmLabel={t('delete')}
          message={t.rich('deleteMessage', {
            name: deleting.name,
            v: (chunks) => <span className="font-medium">{chunks}</span>,
          })}
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
