'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTeamQuery } from '@/services/teams.service';
import { useIntegrationCatalogQuery } from '@/services/integrations.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Button } from '@/components/ui/button';
import { CredentialDialog } from './CredentialDialog';
import TeamIntegrations from './TeamIntegrations';
import AiAssistTeamSettings from './AiAssistTeamSettings';

// The integrations of a team: the API keys of AI providers and the credentials of
// tool integrations, shared by every project the team owns. Secrets are write-only,
// so the list shows only a masked view.
export default function TeamIntegrationsSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams');
  const { data: team } = useTeamQuery(teamId);
  const permissions = team?.permissions.integrations;
  // The catalog names the integrations and builds the credential form, so it is
  // fetched for anyone who may read or add a credential.
  const canSee = !!permissions && (permissions.read || permissions.create);
  const catalog = useIntegrationCatalogQuery(canSee ? teamId : null).data ?? [];
  const [creating, setCreating] = useState(false);

  return (
    <SectionPageView
      title={t('sections.integrations.title')}
      description={t('sections.integrations.description')}
      wide
      actions={
        permissions?.create ? (
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            {t('integrations.add')}
          </Button>
        ) : undefined
      }
    >
      {!permissions ? (
        <ListSkeleton rows={3} rowClassName="h-12" />
      ) : !permissions.read ? (
        <p className="text-sm text-muted-foreground">{t('integrations.noAccess')}</p>
      ) : (
        <TeamIntegrations teamId={teamId} catalog={catalog} permissions={permissions} />
      )}
      {team && (
        <AiAssistTeamSettings
          teamId={teamId}
          catalog={catalog}
          canEdit={team.role === 'owner' || team.role === 'manager'}
        />
      )}

      {creating && (
        <CredentialDialog
          teamId={teamId}
          catalog={catalog}
          existing={null}
          onClose={() => setCreating(false)}
        />
      )}
    </SectionPageView>
  );
}
