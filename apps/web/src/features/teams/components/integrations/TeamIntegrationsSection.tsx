'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTeamQuery } from '@/services/teams.service';
import {
  useCredentialsPageQuery,
  useIntegrationCatalogQuery,
} from '@/services/integrations.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import ListPager from '@/components/common/ListPager';
import { Button } from '@/components/ui/button';
import { usePaging } from '@/hooks/usePaging';
import { useSearchTerm } from '@/hooks/useSearchTerm';
import { CredentialDialog } from './CredentialDialog';
import TeamListToolbar from '../TeamListToolbar';
import TeamIntegrations from './TeamIntegrations';

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
  const paging = usePaging();
  const { search, setSearch, term } = useSearchTerm();
  const [kindFilter, setKindFilter] = useState<string[]>([]);
  // The filter's groups are the kinds the catalog carries, so an edition that adds a
  // kind adds its group.
  const kinds = [...new Set(catalog.map((integration) => integration.kind))];
  const chosenKinds = kinds.filter((kind) => kindFilter.includes(kind));
  const credentialsQuery = useCredentialsPageQuery(permissions?.read ? teamId : null, {
    search: term,
    kinds: chosenKinds.length > 0 ? chosenKinds : undefined,
    ...paging.params,
  });
  const total = credentialsQuery.data?.total ?? 0;

  function onSearchChange(next: string) {
    setSearch(next);
    paging.reset();
  }

  function onKindFilterChange(_key: string, next: string[]) {
    setKindFilter(next);
    paging.reset();
  }

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
      {!team || !permissions ? (
        <ListSkeleton rows={3} rowClassName="h-12" />
      ) : !permissions.read ? (
        <p className="text-sm text-muted-foreground">{t('integrations.noAccess')}</p>
      ) : (
        <div className="space-y-4">
          <TeamListToolbar
            search={search}
            onSearchChange={onSearchChange}
            placeholder={t('integrations.search')}
            sections={[
              {
                key: 'kind',
                label: t('integrations.group'),
                options: kinds.map((kind) => ({
                  value: kind,
                  label: t(`integrations.groups.${kind}.title`),
                })),
                selected: chosenKinds,
              },
            ]}
            onFilterChange={onKindFilterChange}
          />

          <TeamIntegrations
            teamId={teamId}
            teamName={team.name}
            catalog={catalog}
            credentials={credentialsQuery.data?.items ?? []}
            pending={credentialsQuery.isPending}
            permissions={permissions}
            searchTerm={term}
            filtered={chosenKinds.length > 0}
          />
          {total > 0 && <ListPager paging={paging} total={total} />}
        </div>
      )}

      {creating && team && (
        <CredentialDialog
          teamId={teamId}
          teamName={team.name}
          catalog={catalog}
          existing={null}
          onClose={() => setCreating(false)}
        />
      )}
    </SectionPageView>
  );
}
