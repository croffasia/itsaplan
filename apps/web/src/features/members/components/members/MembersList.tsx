'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, LogOut, UserMinus } from 'lucide-react';
import { type MemberRow } from '@/lib/api';
import { formatShortDate } from '@/utils/dates';
import Avatar from '@/components/common/Avatar';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMembersQuery, useRemoveMember } from '@/services/members.service';
import { useRolesQuery } from '@/services/roles.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useSession } from '@/lib/auth-client';
import MemberRoleControl from './MemberRoleControl';
import MemberDescription from './MemberDescription';
import MemberDescriptionDialog from './MemberDescriptionDialog';

// The project's members, one row per person. An owner can revoke anyone's access;
// a member can only leave (remove themselves). The last owner is protected — the
// API rejects it and the action is disabled here too.
export default function MembersList({ projectKey }: { projectKey: string }) {
  const membersQuery = useMembersQuery(projectKey);
  const { can, isOwner } = usePermissions();
  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? null;
  const removeMember = useRemoveMember(projectKey);
  // Roles feed the per-member role select; only an owner can reassign, so only an
  // owner needs the list fetched.
  const rolesQuery = useRolesQuery(projectKey, isOwner);
  const router = useRouter();
  const [target, setTarget] = useState<MemberRow | null>(null);

  const members = membersQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const ownerCount = members.filter((m) => m.role === 'owner').length;

  if (membersQuery.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const targetIsSelf = target?.userId === currentUserId;

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
          <col className="w-[50%]" />
          <col className="w-[22%]" />
          <col className="w-[28%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-medium text-muted-foreground">Member</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">Role</TableHead>
            <TableHead className="text-right text-xs font-medium text-muted-foreground">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => {
            const self = m.userId === currentUserId;
            // Agents join and leave with their AI Agent config, not from this list,
            // so they cannot be revoked or reassigned here.
            const canRemove = !m.isAgent && (self || can('members_manage', 'delete'));
            const canEditDescription = !m.isAgent && (isOwner || self);
            const lastOwner = m.role === 'owner' && ownerCount === 1;
            const removeLabel = self ? 'Leave project' : 'Revoke access';
            return (
              <TableRow key={m.userId} className="group/item">
                <TableCell className="px-3 py-3 align-top whitespace-normal">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Avatar
                      name={m.name || m.email}
                      image={m.image}
                      className="size-8 shrink-0 text-[11px]"
                    />
                    <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{m.name || m.email}</span>
                        {self && (
                          <span className="text-xs font-normal text-muted-foreground">(you)</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        {m.isAgent ? (
                          <Badge
                            variant="secondary"
                            className="gap-1 px-1.5 py-0 text-[10px] font-medium"
                          >
                            <Bot className="size-3" />
                            AI Agent
                          </Badge>
                        ) : (
                          <span className="truncate">{m.email}</span>
                        )}
                        <span>· joined {formatShortDate(m.createdAt)}</span>
                      </span>
                      <MemberDescription member={m} />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-3 pt-4 pb-3 align-top whitespace-normal">
                  <MemberRoleControl
                    projectKey={projectKey}
                    member={m}
                    roles={roles}
                    canManage={isOwner && !self && !m.isAgent}
                    isLastOwner={lastOwner}
                  />
                </TableCell>
                <TableCell className="px-3 pt-3 pb-2 align-top">
                  <div className="flex items-center justify-end gap-1">
                    {canEditDescription && (
                      <MemberDescriptionDialog projectKey={projectKey} member={m} self={self} />
                    )}
                    {canRemove && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            disabled={lastOwner}
                            aria-label={removeLabel}
                            onClick={() => setTarget(m)}
                          >
                            {self ? (
                              <LogOut className="size-4" />
                            ) : (
                              <UserMinus className="size-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {lastOwner ? 'A project must keep at least one owner' : removeLabel}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {target && (
        <ConfirmDialog
          title={
            targetIsSelf ? 'Leave this project' : `Revoke access for ${target.name || target.email}`
          }
          confirmLabel={targetIsSelf ? 'Leave project' : 'Revoke access'}
          onConfirm={confirmRemove}
          onClose={() => setTarget(null)}
        >
          <div className="text-sm text-muted-foreground">
            {targetIsSelf
              ? 'You will lose access to this project and its issues. An owner can invite you back later.'
              : `${target.name || target.email} will lose access to this project. They can be invited back later.`}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
