'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MemberKind } from '@/lib/api';
import { useSearchTerm } from '@/hooks/useSearchTerm';
import { useTeamProjectMembersQuery } from '@/services/teams.service';
import { usePermissionCatalogQuery, useTeamRoleOptionsQuery } from '@/services/roles.service';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { EmptyState } from '@/components/common/page/EmptyState';
import RowAction from '@/components/common/RowAction';
import SearchInput from '@/components/common/SearchInput';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import MemberAddDialog from '@/features/members/components/members/MemberAddDialog';
import TeamProjectMemberCard from './TeamProjectMemberCard';

// Who can reach one project of the team, a page at a time. The search runs on the
// server, so it reaches the members the current page does not hold.
export default function TeamProjectMembers({
  teamId,
  projectId,
  projectKey,
  projectName,
  teamName,
  ownerCount,
  viewerId,
  canEdit,
  canDelete,
  canAdd,
  canInvite,
  canGrantOwner,
  canReadInvites,
}: {
  teamId: number;
  projectId: number;
  projectKey: string;
  projectName: string;
  teamName: string;
  ownerCount: number;
  viewerId: string | undefined;
  canEdit: boolean;
  canDelete: boolean;
  canAdd: boolean;
  canInvite: boolean;
  canGrantOwner: boolean;
  canReadInvites: boolean;
}) {
  const t = useTranslations('teams.panel');
  const tMembers = useTranslations('members');
  const tCommon = useTranslations('common');
  const { search, setSearch, term } = useSearchTerm();
  const [kind, setKind] = useState<MemberKind>('all');
  const [adding, setAdding] = useState(false);

  const membersQuery = useTeamProjectMembersQuery(teamId, projectId, { search: term, kind });
  // The roles carry the matrix each membership resolves to, so they are fetched for
  // every reader of the panel, not only the one who may reassign them.
  const rolesQuery = useTeamRoleOptionsQuery(teamId);
  const catalogQuery = usePermissionCatalogQuery();

  const members = membersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const total = membersQuery.data?.pages[0]?.total ?? 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{t('projectMembers')}</h3>
        {total > 0 && <span className="text-xs text-muted-foreground">{total}</span>}
        {(canAdd || canInvite) && (
          <span className="ms-auto">
            <RowAction icon={Plus} label={tMembers('add.action')} onClick={() => setAdding(true)} />
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('searchMembers')}
          className="min-w-0 flex-1"
        />
        <Select value={kind} onValueChange={(value) => setKind(value as MemberKind)}>
          <SelectTrigger className="h-9 w-[150px]" aria-label={tMembers('tabs.label')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tMembers('tabs.all')}</SelectItem>
            <SelectItem value="human">{tMembers('tabs.people')}</SelectItem>
            <SelectItem value="agent">{tMembers('tabs.agents')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {membersQuery.isPending ? (
        <ListSkeleton rows={4} rowClassName="h-12" />
      ) : members.length === 0 ? (
        <EmptyState
          title={t('noMembersTitle')}
          description={term || kind !== 'all' ? t('noMemberMatches') : t('noProjectMembers')}
        />
      ) : (
        <>
          <div className="space-y-2">
            {members.map((member) => (
              <TeamProjectMemberCard
                key={member.userId}
                projectKey={projectKey}
                member={member}
                roles={rolesQuery.data ?? []}
                catalog={catalogQuery.data}
                self={member.userId === viewerId}
                isLastOwner={member.role === 'owner' && ownerCount === 1}
                canEdit={canEdit}
                canDelete={canDelete}
                canGrantOwner={canGrantOwner}
              />
            ))}
          </div>
          {membersQuery.hasNextPage && (
            <Button
              variant="outline"
              className="w-full"
              disabled={membersQuery.isFetchingNextPage}
              onClick={() => void membersQuery.fetchNextPage()}
            >
              {tCommon('showMore')}
            </Button>
          )}
        </>
      )}

      {adding && (
        <MemberAddDialog
          projectKey={projectKey}
          projectName={projectName}
          teamId={teamId}
          teamName={teamName}
          canAdd={canAdd}
          canInvite={canInvite}
          canGrantOwner={canGrantOwner}
          canReadInvites={canReadInvites}
          onClose={() => setAdding(false)}
        />
      )}
    </section>
  );
}
