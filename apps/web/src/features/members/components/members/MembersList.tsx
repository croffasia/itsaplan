'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { MemberKind, MemberRow as Member } from '@/lib/api/endpoints/members';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import MembersEmptyState from '@/components/common/page/MembersEmptyState';
import SearchInput from '@/components/common/SearchInput';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMembersQuery, useRemoveMember } from '@/services/members.service';
import { useTeamRoleOptionsQuery } from '@/services/roles.service';
import { useSearchTerm } from '@/hooks/useSearchTerm';
import { usePermissions } from '@/hooks/usePermissions';
import { useSession } from '@/lib/auth-client';
import ListPager from '@/components/common/ListPager';
import { usePaging } from '@/hooks/usePaging';
import MemberRow from './MemberRow';

// The project's members, newest membership first, a page at a time. People and AI
// agents share one list and are told apart by the tabs, so neither is pushed off the
// first page by the other; the search runs on the server, within the open tab. The
// last owner is protected — the API rejects removing them and the row's action is
// disabled too.
export default function MembersList({
  projectKey,
  teamId,
}: {
  projectKey: string;
  teamId: number;
}) {
  const t = useTranslations('members');
  const [kind, setKind] = useState<MemberKind>('all');
  const { search, setSearch, term } = useSearchTerm();
  const paging = usePaging();
  const { can, isAdmin } = usePermissions();
  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? null;
  const removeMember = useRemoveMember(projectKey);
  // Roles feed the per-member role select, so the list is only fetched for a reader
  // who gets one.
  const canEdit = can('members_manage', 'edit') || isAdmin;
  const rolesQuery = useTeamRoleOptionsQuery(canEdit ? teamId : null);
  const router = useRouter();
  const [target, setTarget] = useState<Member | null>(null);

  const membersQuery = useMembersQuery(projectKey, { search: term, kind, ...paging.params });

  const members = membersQuery.data?.items ?? [];
  const roles = rolesQuery.data ?? [];
  const total = membersQuery.data?.total ?? 0;
  const ownerCount = membersQuery.data?.ownerCount ?? 0;

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
    all: t('search.all'),
    human: t('search.people'),
    agent: t('search.agents'),
  }[kind];

  if (membersQuery.isPending) return <ListSkeleton className="mb-8" rowClassName="h-14" />;

  const targetIsSelf = target?.userId === currentUserId;
  const targetName = target ? target.name || target.email : '';

  async function confirmRemove() {
    if (!target) return;
    await removeMember.mutateAsync(target.userId);
    setTarget(null);
    // Leaving the project revokes your own access; return to the app root, which
    // reopens a project you still belong to.
    if (targetIsSelf) {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="mb-8 flex min-h-0 flex-1 flex-col gap-4">
      <Tabs value={kind} onValueChange={onKindChange}>
        <div className="flex items-center justify-between gap-3">
          <TabsList variant="line" className="w-auto border-b-0">
            <TabsTrigger value="all">{t('tabs.all')}</TabsTrigger>
            <TabsTrigger value="human">{t('tabs.people')}</TabsTrigger>
            <TabsTrigger value="agent">{t('tabs.agents')}</TabsTrigger>
          </TabsList>
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            className="w-60 shrink-0"
          />
        </div>
      </Tabs>

      {members.length === 0 ? (
        <MembersEmptyState kind={kind} searching={term !== undefined} />
      ) : (
        <Table className="min-w-[720px] table-fixed">
          <colgroup>
            <col className="w-[36%]" />
            <col className="w-[17%]" />
            <col className="w-[17%]" />
            <col className="w-[13%]" />
            <col className="w-[17%]" />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground">
                {t('columns.member')}
              </TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">
                {t('columns.role')}
              </TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">
                {t('columns.timezone')}
              </TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">
                {t('columns.joined')}
              </TableHead>
              <TableHead className="text-right text-xs font-medium text-muted-foreground">
                {t('columns.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <MemberRow
                key={m.userId}
                projectKey={projectKey}
                member={m}
                roles={roles}
                isLastOwner={m.role === 'owner' && ownerCount === 1}
                onRemove={setTarget}
              />
            ))}
          </TableBody>
        </Table>
      )}

      {total > 0 && <ListPager paging={paging} total={total} />}

      {target && (
        <ConfirmDialog
          title={targetIsSelf ? t('leaveTitle') : t('revokeTitle', { name: targetName })}
          confirmLabel={targetIsSelf ? t('leaveProject') : t('revokeAccess')}
          onConfirm={confirmRemove}
          onClose={() => setTarget(null)}
        >
          <div className="text-sm text-muted-foreground">
            {targetIsSelf ? t('leaveDescription') : t('revokeDescription', { name: targetName })}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
