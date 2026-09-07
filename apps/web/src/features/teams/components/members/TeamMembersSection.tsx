'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { InviteRow, MemberKind, TeamMember } from '@/lib/api';
import {
  useDeleteTeamInvite,
  useRemoveTeamMember,
  useTeam,
  useTeamInvitesQuery,
  useTeamMembersQuery,
} from '@/services/teams.service';
import { useRouter } from 'next/navigation';
import { useSearchTerm } from '@/hooks/useSearchTerm';
import { useSession } from '@/lib/auth-client';
import { teamSectionPath } from '@/utils/paths';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import ListPager from '@/components/common/ListPager';
import { usePaging } from '@/hooks/usePaging';
import SearchInput from '@/components/common/SearchInput';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import MembersEmptyState from '@/components/common/page/MembersEmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TeamInviteDialog from './TeamInviteDialog';
import TeamInviteRow from './TeamInviteRow';
import TeamMemberRow from './TeamMemberRow';

// The team's members, a page at a time, with the invites that have not been answered
// yet above them. People and agents work on one board, so both are listed and the tabs
// tell them apart; selecting an agent opens the section that configures it. Owners and
// managers run the list, so only they invite and see the pending invites; only an owner
// removes a person from it.
export default function TeamMembersSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams');
  const tMembers = useTranslations('members');
  const tInvite = useTranslations('teams.invite');
  const tCommon = useTranslations('common');
  const team = useTeam(teamId);
  const [kind, setKind] = useState<MemberKind>('all');
  const { search, setSearch, term } = useSearchTerm();
  const paging = usePaging();
  const membersQuery = useTeamMembersQuery(teamId, { search: term, kind, ...paging.params });
  const canInvite = team != null && team.role !== 'member';
  const invitesQuery = useTeamInvitesQuery(teamId, canInvite);
  const deleteInvite = useDeleteTeamInvite(teamId);
  const removeMember = useRemoveTeamMember(teamId);
  const [inviting, setInviting] = useState(false);
  const [target, setTarget] = useState<InviteRow | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const router = useRouter();
  const { data: session } = useSession();

  const members = membersQuery.data?.items ?? [];
  const total = membersQuery.data?.total ?? 0;
  // An invite is nobody yet, so it matches no tab and no search term: the rows only
  // stand above the first page of the plain list.
  const pending =
    paging.params.page === 1 && kind !== 'agent' && term === undefined
      ? (invitesQuery.data ?? []).filter((invite) => invite.status === 'pending')
      : [];

  function onKindChange(next: string) {
    setKind(next as MemberKind);
    paging.reset();
  }

  function onSearchChange(next: string) {
    setSearch(next);
    paging.reset();
  }

  // The placeholder names what the open tab holds, so the search says what it covers.
  const searchPlaceholder = {
    all: tMembers('search.all'),
    human: tMembers('search.people'),
    agent: tMembers('search.agents'),
  }[kind];

  return (
    <SectionPageView
      title={t('sections.members.title')}
      description={t('sections.members.description')}
      wide
      actions={
        canInvite ? (
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setInviting(true)}>
            <Plus className="size-3.5" />
            {tInvite('action')}
          </Button>
        ) : undefined
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <Tabs value={kind} onValueChange={onKindChange}>
          <div className="flex items-center justify-between gap-3">
            <TabsList variant="line" className="w-auto border-b-0">
              <TabsTrigger value="all">{tMembers('tabs.all')}</TabsTrigger>
              <TabsTrigger value="human">{tMembers('tabs.people')}</TabsTrigger>
              <TabsTrigger value="agent">{tMembers('tabs.agents')}</TabsTrigger>
            </TabsList>
            <SearchInput
              value={search}
              onChange={onSearchChange}
              placeholder={searchPlaceholder}
              className="w-60 shrink-0"
            />
          </div>
        </Tabs>

        {membersQuery.isPending ? (
          <ListSkeleton rows={4} rowClassName="h-12" />
        ) : members.length === 0 && pending.length === 0 ? (
          <MembersEmptyState kind={kind} searching={term !== undefined} />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[720px] table-fixed">
              <colgroup>
                <col className="w-[46%]" />
                <col className="w-[16%]" />
                <col className="w-[20%]" />
                <col className="w-[18%]" />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    {t('columns.account')}
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    {t('columns.role')}
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    {t('columns.joined')}
                  </TableHead>
                  <TableHead className="text-end text-xs font-medium text-muted-foreground">
                    {tCommon('actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((invite) => (
                  <TeamInviteRow key={invite.id} invite={invite} onRevoke={setTarget} />
                ))}
                {members.map((member) => (
                  <TeamMemberRow
                    key={member.userId}
                    member={member}
                    teamId={teamId}
                    viewerRole={team?.role ?? 'member'}
                    self={member.userId === session?.user.id}
                    onRemove={member.agentId == null ? setRemoving : undefined}
                    onOpen={
                      member.agentId != null
                        ? () => router.push(teamSectionPath(teamId, 'ai-agents'))
                        : undefined
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {total > 0 && <ListPager paging={paging} total={total} />}
      </div>

      {inviting && team && (
        <TeamInviteDialog
          teamId={teamId}
          teamName={team.name}
          teamRole={team.role}
          onClose={() => setInviting(false)}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={t('members.removeTitle', { name: removing.name || removing.email })}
          confirmLabel={t('members.removeConfirm')}
          onConfirm={async () => {
            await removeMember.mutateAsync(removing.userId);
            setRemoving(null);
            toast.success(t('members.removed', { name: removing.name || removing.email }));
          }}
          onClose={() => setRemoving(null)}
        >
          <div className="text-sm text-muted-foreground">{t('members.removeDescription')}</div>
        </ConfirmDialog>
      )}

      {target && (
        <ConfirmDialog
          title={tInvite('revokeTitle', { email: target.email })}
          confirmLabel={tInvite('revokeConfirm')}
          onConfirm={async () => {
            await deleteInvite.mutateAsync(target.id);
            setTarget(null);
          }}
          onClose={() => setTarget(null)}
        >
          <div className="text-sm text-muted-foreground">{tInvite('revokeDescription')}</div>
        </ConfirmDialog>
      )}
    </SectionPageView>
  );
}
