'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Role } from '@/lib/api/endpoints/roles';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { PermissionsPopover } from '@/components/common/permissions/PermissionsPopover';
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
import { useDeleteSystemRole } from '../../services/god.service';

export default function GodRolesTable({
  roles,
  onEdit,
}: {
  roles: Role[];
  onEdit: (role: Role) => void;
}) {
  const t = useTranslations('god.roles');
  const tCommon = useTranslations('common');
  const deleteRole = useDeleteSystemRole();
  const [deleting, setDeleting] = useState<Role | null>(null);

  return (
    <>
      <Table className="min-w-[560px] table-fixed">
        <colgroup>
          <col className="w-[62%]" />
          <col className="w-[28%]" />
          <col className="w-[10%]" />
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
            <TableRow key={role.id} className="cursor-pointer" onClick={() => onEdit(role)}>
              <TableCell className="px-3 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{role.name}</span>
                  {role.isDefault && (
                    <Badge
                      variant="secondary"
                      className="shrink-0 px-1.5 py-0 text-[10px] font-normal"
                    >
                      {t('default')}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                <PermissionsPopover permissions={role.permissions} />
              </TableCell>
              <TableCell className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    aria-label={t('edit')}
                    title={t('edit')}
                    onClick={() => onEdit(role)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          disabled={role.isDefault}
                          aria-label={t('delete')}
                          onClick={() => setDeleting(role)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {role.isDefault ? t('defaultUndeletable') : t('delete')}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {deleting && (
        <ConfirmDialog
          title={t('deleteTitle', { name: deleting.name })}
          confirmLabel={t('delete')}
          onConfirm={async () => {
            await deleteRole.mutateAsync(deleting.id);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        >
          <p className="text-sm text-muted-foreground">{t('deleteDescription')}</p>
        </ConfirmDialog>
      )}
    </>
  );
}
