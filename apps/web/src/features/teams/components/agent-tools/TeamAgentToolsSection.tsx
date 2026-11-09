'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTeamQuery } from '@/services/teams.service';
import { useIntegrationCatalogQuery } from '@/services/integrations.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Button } from '@/components/ui/button';
import { ToolConfigDialog } from './ToolConfigDialog';
import TeamAgentTools from './TeamAgentTools';

// The configured tools of a team: external integrations the internal agents of its
// projects can call, each bound to one of the team's credentials.
export default function TeamAgentToolsSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams');
  const { data: team } = useTeamQuery(teamId);
  const permissions = team?.permissions.agent_tools;
  // The catalog names the tools and their integrations, so it is fetched for anyone
  // who may read the list or add a tool.
  const canSee = !!permissions && (permissions.read || permissions.create);
  const catalog = useIntegrationCatalogQuery(canSee ? teamId : null).data ?? [];
  const [creating, setCreating] = useState(false);

  return (
    <SectionPageView
      title={t('sections.agentTools.title')}
      description={t('sections.agentTools.description')}
      wide
      actions={
        permissions?.create ? (
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            {t('tools.add')}
          </Button>
        ) : undefined
      }
    >
      {!permissions ? (
        <ListSkeleton rows={3} rowClassName="h-12" />
      ) : !permissions.read ? (
        <p className="text-sm text-muted-foreground">{t('tools.noAccess')}</p>
      ) : (
        <TeamAgentTools teamId={teamId} catalog={catalog} permissions={permissions} />
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
