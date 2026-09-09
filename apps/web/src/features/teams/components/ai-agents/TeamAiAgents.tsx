import { useState } from 'react';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { useAiAgentsQuery, useDeleteAiAgent } from '@/services/aiAgents.service';
import { useIntegrationCatalogQuery } from '@/services/integrations.service';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import ListPager from '@/components/common/ListPager';
import { usePaging } from '@/hooks/usePaging';
import { useAgentSection } from '../../context/agentSection';
import { TeamAiAgentRow } from './TeamAiAgentRow';
import { TeamAiAgentSheet } from './TeamAiAgentSheet';
import { TeamAiAgentRunsSheet } from './TeamAiAgentRunsSheet';
import { integrationLabel } from '@/utils/integrationLabels';
import { useTranslations } from 'next-intl';

// The agents of a team: bot users that issues can be delegated to in any project the
// team attaches them to. An external agent is driven through the API; an internal
// agent runs on the built-in runtime and carries provider/model/instructions/tools.
// Creating and editing happen in the same full-width sheet, which also owns an
// external agent's API key: the sheet reveals it once on create and is where it is
// regenerated.
export default function TeamAiAgents() {
  const t = useTranslations('teams.agents');
  const tCommon = useTranslations('common');
  const { teamId } = useAgentSection();
  const agentsQuery = useAiAgentsQuery(teamId);
  const agents = agentsQuery.data ?? [];
  const deleteAgent = useDeleteAiAgent(teamId);
  // The integration catalog maps a provider key to a readable label for the meta row.
  const catalog = useIntegrationCatalogQuery(teamId).data ?? [];

  // The agent the sheet edits, by id; null means the sheet is closed. Creating one is
  // the section's own sheet, above this list.
  const [editingId, setEditingId] = useState<number | null>(null);
  // The agent whose run history sidebar is open.
  const [runsAgent, setRunsAgent] = useState<AiAgent | null>(null);
  const [deleting, setDeleting] = useState<AiAgent | null>(null);
  const paging = usePaging();

  const editing = agents.find((a) => a.id === editingId) ?? null;
  // The team's agents come in one list — the sheets and the project screens read it
  // whole — so the page is cut here rather than asked for.
  const shown = paging.slice(agents);

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
              <col className="w-[32%]" />
              <col className="w-[20%]" />
              <col className="w-[36%]" />
              <col className="w-[12%]" />
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
                <TableHead className="text-end text-xs font-medium text-muted-foreground">
                  {tCommon('actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((a) => (
                <TeamAiAgentRow
                  key={a.id}
                  agent={a}
                  providerLabel={(key: string) => integrationLabel(catalog, key)}
                  onChat={() => setEditingId(a.id)}
                  onRuns={() => setRunsAgent(a)}
                  onEdit={() => setEditingId(a.id)}
                  onDelete={() => setDeleting(a)}
                />
              ))}
            </TableBody>
          </Table>
          <ListPager paging={paging} total={agents.length} />
        </div>
      )}

      <TeamAiAgentSheet
        open={editingId != null}
        agent={editing}
        onClose={() => setEditingId(null)}
      />

      <TeamAiAgentRunsSheet agent={runsAgent} onClose={() => setRunsAgent(null)} />

      {deleting && (
        <ConfirmDialog
          title={t('delete')}
          confirmLabel={t('delete')}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteAgent.mutateAsync(deleting.id);
            setDeleting(null);
          }}
        >
          <p className="text-sm text-muted-foreground">
            {t.rich('deleteMessage', {
              name: deleting.name,
              v: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
