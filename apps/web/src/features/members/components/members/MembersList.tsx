'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { MemberRow as Member } from '@/lib/api';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMembersQuery, useRemoveMember } from '@/services/members.service';
import { useRolesQuery } from '@/services/roles.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useSession } from '@/lib/auth-client';
import MemberRow from './MemberRow';

// The project's members, people first and AI agents in their own group below.
// The last owner is protected — the API rejects removing them and the row's
// action is disabled too.
export default function MembersList({ projectKey }: { projectKey: string }) {
  const t = useTranslations('members');
  const membersQuery = useMembersQuery(projectKey);
  const { isOwner } = usePermissions();
  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? null;
  const removeMember = useRemoveMember(projectKey);
  // Roles feed the per-member role select; only an owner can reassign, so only an
  // owner needs the list fetched.
  const rolesQuery = useRolesQuery(projectKey, isOwner);
  const router = useRouter();
  const [target, setTarget] = useState<Member | null>(null);

  const members = membersQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const ownerCount = members.filter((m) => m.role === 'owner').length;
  const groups = [
    { key: 'people', label: t('groups.people'), rows: members.filter((m) => !m.isAgent) },
    { key: 'agents', label: t('groups.agents'), rows: members.filter((m) => m.isAgent) },
  ].filter((group) => group.rows.length > 0);

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
    <div className="mb-8 space-y-4">
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
        {/* The row before a group heading drops its border: the heading already
            separates the two groups, and a line above it reads as a second one. */}
        <TableBody className="[&_tr:has(+tr[data-group-heading])]:border-b-0">
          {groups.map((group) => (
            <Fragment key={group.key}>
              <TableRow data-group-heading className="border-0 hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="px-3 pt-5 pb-1 text-xs font-medium text-muted-foreground"
                >
                  {group.label}
                </TableCell>
              </TableRow>
              {group.rows.map((m) => (
                <MemberRow
                  key={m.userId}
                  projectKey={projectKey}
                  member={m}
                  roles={roles}
                  isLastOwner={m.role === 'owner' && ownerCount === 1}
                  onRemove={setTarget}
                />
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>

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
