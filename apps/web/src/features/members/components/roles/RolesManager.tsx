'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Role } from '@/lib/api';
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
import { usePermissions } from '@/hooks/usePermissions';
import { useDeleteRole, usePermissionCatalogQuery, useRolesQuery } from '@/services/roles.service';
import RoleEditorPanel from './RoleEditorPanel';
import { PermissionsPopover } from '@/components/common/permissions/PermissionsPopover';

// The project's custom roles table: edit the permission matrix and delete a role.
// Creating a role and the copy/paste transfer live in the page header (RolesToolbar).
// Owner-only — the API rejects a non-owner's writes, so a member sees a notice. The
// default role cannot be deleted (no delete action on it).
export default function RolesManager({ projectKey }: { projectKey: string }) {
  const { isOwner } = usePermissions();
  const rolesQuery = useRolesQuery(projectKey, isOwner);
  const catalogQuery = usePermissionCatalogQuery();
  const deleteRole = useDeleteRole(projectKey);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);

  if (!isOwner)
    return <p className="text-sm text-muted-foreground">Only project owners can manage roles.</p>;

  const roles = rolesQuery.data ?? [];
  const catalog = catalogQuery.data ?? null;

  return (
    <div>
      {rolesQuery.isPending ? (
        <p className="py-4 text-sm text-muted-foreground">Loading…</p>
      ) : roles.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No roles yet. Create one to grant scoped access.
        </p>
      ) : (
        <Table className="min-w-[640px] table-fixed">
          <colgroup>
            <col className="w-[32%]" />
            <col className="w-[54%]" />
            <col className="w-[14%]" />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground">Role</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">
                Permissions
              </TableHead>
              <TableHead className="text-right text-xs font-medium text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id} className="group/item">
                <TableCell className="px-3 py-3 align-top whitespace-normal">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{role.name}</span>
                    {role.isDefault && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                        Default
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3 align-top whitespace-normal">
                  <PermissionsPopover permissions={role.permissions} />
                </TableCell>
                <TableCell className="px-3 py-2 align-top">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          disabled={!catalog}
                          aria-label="Edit role"
                          onClick={() => setEditing(role)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit role</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            disabled={role.isDefault}
                            aria-label="Delete role"
                            onClick={() => setDeleting(role)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {role.isDefault ? 'The default role cannot be deleted' : 'Delete role'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editing && catalog && (
        <RoleEditorPanel
          projectKey={projectKey}
          role={editing}
          catalog={catalog}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete role "${deleting.name}"`}
          confirmLabel="Delete role"
          onConfirm={async () => {
            await deleteRole.mutateAsync(deleting.id);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        >
          <div className="text-sm text-muted-foreground">
            Members with this role will be moved to the default role. This cannot be undone.
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
