import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { useAiAgentsQuery, useDeleteAiAgent } from '@/services/aiAgents.service';
import { useIntegrationCatalogQuery } from '@/services/integrations.service';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import ListPager from '@/components/common/ListPager';
import { usePaging } from '@/hooks/usePaging';
import { integrationOf } from '@/utils/integrationLabels';
import {
  useTeam,
  useTeamProjectDefaultsQuery,
  useUpdateTeamProjectDefaults,
} from '@/services/teams.service';
import { useAgentSection } from '../../context/agentSection';
import { useAgentFilters } from '../../hooks/useAgentFilters';
import TeamListToolbar from '../TeamListToolbar';
import { TeamAiAgentRow } from './TeamAiAgentRow';
import { TeamAiAgentSheet } from './TeamAiAgentSheet';
import { TeamAiAgentRunsSheet } from './TeamAiAgentRunsSheet';
import { TeamAiAgentTable } from './TeamAiAgentTable';

// The agents of a team: bot users that issues can be delegated to in any project the
// team attaches them to. An external agent is driven through the API; an internal
// agent runs on the built-in runtime and carries provider/model/instructions/tools.
// Creating and editing happen in the same full-width sheet, which also owns an
// external agent's API key: the sheet reveals it once on create and is where it is
// regenerated.
export default function TeamAiAgents() {
  const t = useTranslations('teams.agents');
  const { teamId } = useAgentSection();
  const agentsQuery = useAiAgentsQuery(teamId);
  const agents = agentsQuery.data ?? [];
  const team = useTeam(teamId);
  const { data: defaults } = useTeamProjectDefaultsQuery(teamId);
  const updateDefaults = useUpdateTeamProjectDefaults(teamId);
  const defaultIds = defaults?.defaultAgentIds ?? [];
  const canEditDefaults = team != null && team.role !== 'member';
  const deleteAgent = useDeleteAiAgent(teamId);
  const catalog = useIntegrationCatalogQuery(teamId).data ?? [];
  const providerLabel = (key: string) => integrationOf(catalog, key).label;
  const filters = useAgentFilters(agents, providerLabel, defaultIds);

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
  const shown = paging.slice(filters.filtered);

  function onSearchChange(next: string) {
    filters.setSearch(next);
    paging.reset();
  }

  function onFilterChange(key: string, next: string[]) {
    filters.setFilter(key, next);
    paging.reset();
  }

  const row = (a: AiAgent) => (
    <TeamAiAgentRow
      key={a.id}
      agent={a}
      providerLabel={providerLabel}
      highlightProjects={filters.projectIds}
      onChat={() => setEditingId(a.id)}
      onRuns={() => setRunsAgent(a)}
      onEdit={() => setEditingId(a.id)}
      onDelete={() => setDeleting(a)}
      joinsNewProjects={defaultIds.includes(a.id)}
      joinsNewProjectsPending={updateDefaults.isPending}
      onJoinsNewProjectsChange={
        canEditDefaults && defaults
          ? (on) =>
              updateDefaults.mutate(
                on ? [...defaultIds, a.id] : defaultIds.filter((id) => id !== a.id),
                {
                  onSuccess: () =>
                    toast.success(
                      t(on ? 'joinsNewProjectsSaved' : 'skipsNewProjectsSaved', { agent: a.name }),
                    ),
                },
              )
          : undefined
      }
    />
  );

  return (
    <>
      {agentsQuery.isPending ? (
        <ListSkeleton rows={3} rowClassName="h-12" />
      ) : agents.length === 0 ? (
        <EmptyState title={t('empty')} description={t('emptyHint')} />
      ) : (
        <div className="space-y-6">
          <TeamListToolbar
            search={filters.search}
            onSearchChange={onSearchChange}
            placeholder={t('search')}
            sections={filters.sections}
            onFilterChange={onFilterChange}
          />
          {filters.filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noMatches')}</p>
          ) : (
            <>
              <TeamAiAgentTable canEditDefaults={canEditDefaults}>
                {shown.map(row)}
              </TeamAiAgentTable>
              <ListPager paging={paging} total={filters.filtered.length} />
            </>
          )}
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
          title={t('deleteTitle')}
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
