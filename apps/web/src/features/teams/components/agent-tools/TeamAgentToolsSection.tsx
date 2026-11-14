'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useToolSources } from '@/cloud';
import type { ConfiguredTool } from '@/lib/api/endpoints/agentTools';
import { useTeamQuery } from '@/services/teams.service';
import { useIntegrationCatalogQuery } from '@/services/integrations.service';
import { useConfiguredToolsPageQuery } from '@/services/customTools.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import ListPager from '@/components/common/ListPager';
import { usePaging } from '@/hooks/usePaging';
import { useSearchTerm } from '@/hooks/useSearchTerm';
import { ToolConfigDialog } from './ToolConfigDialog';
import ToolAddActions from './ToolAddActions';
import TeamAgentTools from './TeamAgentTools';
import ToolListToolbar, { ALL_GROUPS } from './ToolListToolbar';

// The configured tools of a team: external integrations the agents of its projects can
// call, each bound to one of the team's credentials, and the tools the team defines
// itself, each opened in its source's panel.
export default function TeamAgentToolsSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams');
  const { data: team } = useTeamQuery(teamId);
  const permissions = team?.permissions.agent_tools;
  // The catalog names the tools and their integrations, so it is fetched for anyone
  // who may read the list or add a tool.
  const canSee = !!permissions && (permissions.read || permissions.create);
  const catalog = useIntegrationCatalogQuery(canSee ? teamId : null).data ?? [];
  const [creating, setCreating] = useState(false);
  const sources = useToolSources();
  // The source panel open, on a tool of that source or on a new one.
  const [editing, setEditing] = useState<{ source: string; tool: ConfiguredTool | null } | null>(
    null,
  );
  const editor = sources.find((s) => s.kind === 'source' && s.key === editing?.source);
  const paging = usePaging();
  const { search, setSearch, term } = useSearchTerm();
  const [group, setGroup] = useState(ALL_GROUPS);
  const toolsQuery = useConfiguredToolsPageQuery(permissions?.read ? teamId : null, {
    search: term,
    group: group === ALL_GROUPS ? undefined : group,
    ...paging.params,
  });
  const total = toolsQuery.data?.total ?? 0;

  function onSearchChange(next: string) {
    setSearch(next);
    paging.reset();
  }

  function onGroupChange(next: string) {
    setGroup(next);
    paging.reset();
  }

  return (
    <SectionPageView
      title={t('sections.agentTools.title')}
      description={t('sections.agentTools.description')}
      wide
      actions={
        permissions?.create ? (
          <ToolAddActions
            sources={sources}
            onCreate={(source) => setEditing({ source, tool: null })}
            onAdd={() => setCreating(true)}
          />
        ) : undefined
      }
    >
      {!permissions ? (
        <ListSkeleton rows={3} rowClassName="h-12" />
      ) : !permissions.read ? (
        <p className="text-sm text-muted-foreground">{t('tools.noAccess')}</p>
      ) : (
        <div className="space-y-4">
          <ToolListToolbar
            catalog={catalog}
            sources={sources}
            group={group}
            onGroupChange={onGroupChange}
            search={search}
            onSearchChange={onSearchChange}
          />

          <TeamAgentTools
            teamId={teamId}
            catalog={catalog}
            tools={toolsQuery.data?.items ?? []}
            pending={toolsQuery.isPending}
            canDelete={permissions.delete}
            searchTerm={term}
            grouped={group !== ALL_GROUPS}
            sources={sources}
            onOpen={(tool) => tool.source && setEditing({ source: tool.source, tool })}
          />
          {total > 0 && <ListPager paging={paging} total={total} />}
        </div>
      )}

      {editing && editor?.kind === 'source' && (
        <editor.Editor teamId={teamId} tool={editing.tool} onClose={() => setEditing(null)} />
      )}

      {creating && team && (
        <ToolConfigDialog
          teamId={teamId}
          teamName={team.name}
          canAddCredential={team.permissions.integrations.create}
          catalog={catalog}
          onClose={() => setCreating(false)}
        />
      )}
    </SectionPageView>
  );
}
