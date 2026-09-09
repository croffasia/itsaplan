'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Role } from '@/lib/api/endpoints/roles';
import {
  usePermissionCatalogQuery,
  useTeamRoleOptionsQuery,
  useTeamRolesQuery,
} from '@/services/roles.service';
import { useTeam } from '@/services/teams.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import ListPager from '@/components/common/ListPager';
import SearchInput from '@/components/common/SearchInput';
import { usePaging } from '@/hooks/usePaging';
import { useSearchTerm } from '@/hooks/useSearchTerm';
import RoleEditorPanel from './RoleEditorPanel';
import TeamRolesList from './TeamRolesList';
import TeamRolesToolbar from './TeamRolesToolbar';

// The roles section of a team: the roles every project of the team assigns from,
// with the editor they are created and changed in. The team's owner and managers
// manage them, and deleting one is the owner's alone; a plain member reads a notice
// instead of the list.
export default function TeamRolesSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams');
  const team = useTeam(teamId);
  const canManage = team?.role === 'owner' || team?.role === 'manager';
  const paging = usePaging();
  const { search, setSearch, term } = useSearchTerm();
  const rolesQuery = useTeamRolesQuery(canManage ? teamId : null, {
    search: term,
    ...paging.params,
  });
  // The clipboard actions carry every role of the team, and the delete dialog moves a
  // role's members to one of them, so both read the whole list rather than the page.
  const allRoles = useTeamRoleOptionsQuery(canManage ? teamId : null).data ?? [];
  const catalogQuery = usePermissionCatalogQuery();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);

  const roles = rolesQuery.data?.items ?? [];
  const total = rolesQuery.data?.total ?? 0;
  const catalog = catalogQuery.data ?? null;
  const editorOpen = creating || editing !== null;

  function onSearchChange(next: string) {
    setSearch(next);
    paging.reset();
  }

  return (
    <SectionPageView
      title={t('sections.roles.title')}
      description={t('sections.roles.description')}
      wide
      actions={
        canManage ? (
          <TeamRolesToolbar
            teamId={teamId}
            roles={allRoles}
            catalog={catalog}
            onCreate={() => setCreating(true)}
          />
        ) : undefined
      }
    >
      {!team ? (
        <ListSkeleton rows={4} rowClassName="h-12" />
      ) : !canManage ? (
        <p className="text-sm text-muted-foreground">{t('roles.ownerOnly')}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <SearchInput
              value={search}
              onChange={onSearchChange}
              placeholder={t('roles.search')}
              className="w-60"
            />
          </div>

          <TeamRolesList
            teamId={teamId}
            roles={roles}
            allRoles={allRoles}
            pending={rolesQuery.isPending}
            canEdit={catalog !== null}
            canDelete={team.role === 'owner'}
            searchTerm={term}
            onEdit={setEditing}
          />
          {total > 0 && <ListPager paging={paging} total={total} />}
        </div>
      )}

      {editorOpen && catalog && (
        <RoleEditorPanel
          teamId={teamId}
          role={editing}
          catalog={catalog}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </SectionPageView>
  );
}
