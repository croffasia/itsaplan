'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Role } from '@/lib/api/endpoints/roles';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
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
import { PermissionsPopover } from '@/components/common/permissions/PermissionsPopover';
import DeleteRoleDialog from './DeleteRoleDialog';

// The roles the team assigns, one row each: what it grants, and the actions to edit or
// delete it. A system role is god mode's, so its row has neither. Deleting is the
// owner's, so a manager gets the row without that action. Deleting a role moves what is
// on it to a role the dialog asks for, which is why it is handed every role the team
// assigns and not only the page on screen.
export default function TeamRolesList({
  teamId,
  roles,
  allRoles,
  pending,
  canEdit,
  canDelete,
  searchTerm,
  onEdit,
}: {
  teamId: number;
  roles: Role[];
  allRoles: Role[];
  pending: boolean;
  canEdit: boolean;
  canDelete: boolean;
  searchTerm: string | undefined;
  onEdit: (role: Role) => void;
}) {
  const t = useTranslations('teams');
  const tCommon = useTranslations('common');
  const [deleting, setDeleting] = useState<Role | null>(null);

  if (pending) return <ListSkeleton rows={2} rowClassName="h-12" />;
  if (roles.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {searchTerm === undefined ? t('roles.empty') : t('roles.noMatches', { query: searchTerm })}
      </p>
    );

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[560px] table-fixed">
        <colgroup>
          <col className="w-[56%]" />
          <col className="w-[26%]" />
          <col className="w-[18%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('columns.role')}
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('columns.permissions')}
            </TableHead>
            <TableHead className="text-end text-xs font-medium text-muted-foreground">
              {tCommon('actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow
              key={role.id}
              className={canEdit && !role.system ? 'cursor-pointer' : undefined}
              onClick={() => canEdit && !role.system && onEdit(role)}
            >
              <TableCell className="px-3 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{role.name}</span>
                  {role.system && (
                    <Badge
                      variant="outline"
                      className="shrink-0 px-1.5 py-0 text-[10px] font-normal"
                    >
                      {t('roles.system')}
                    </Badge>
                  )}
                  {role.isDefault && (
                    <Badge
                      variant="secondary"
                      className="shrink-0 px-1.5 py-0 text-[10px] font-normal"
                    >
                      {t('roles.default')}
                    </Badge>
                  )}
                </div>
              </TableCell>

              <TableCell className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                <PermissionsPopover permissions={role.permissions} />
              </TableCell>

              <TableCell className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                {!role.system && (
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      disabled={!canEdit}
                      aria-label={t('roles.editAction')}
                      title={t('roles.editAction')}
                      onClick={() => onEdit(role)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label={t('roles.deleteAction')}
                        title={t('roles.deleteAction')}
                        onClick={() => setDeleting(role)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {deleting && (
        <DeleteRoleDialog
          teamId={teamId}
          role={deleting}
          roles={allRoles}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
