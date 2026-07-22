'use client';

import { Copy, LogOut, Trash2 } from 'lucide-react';
import type { Project } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PermissionsPopover } from '@/components/common/permissions/PermissionsPopover';
import ManageProjectsRowAction from './ManageProjectsRowAction';

export default function ManageProjectsList({
  projects,
  isPending,
  onCopy,
  onDelete,
  onLeave,
}: {
  projects: Project[];
  isPending: boolean;
  onCopy: (project: Project) => void;
  onDelete: (project: Project) => void;
  onLeave: (project: Project) => void;
}) {
  if (isPending) {
    return (
      <div className="space-y-2 py-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">You are not a member of any project yet.</p>
    );
  }

  return (
    <Table className="mt-2 min-w-[640px] table-fixed">
      <colgroup>
        <col className="w-[46%]" />
        <col className="w-[14%]" />
        <col className="w-[28%]" />
        <col className="w-[12%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-xs font-medium text-muted-foreground">Project</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Role</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Permissions</TableHead>
          <TableHead className="text-right text-xs font-medium text-muted-foreground">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <TableRow key={project.key} className="group/item">
            <TableCell className="px-3 py-3 align-top">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="secondary" className="shrink-0 font-mono">
                  {project.key}
                </Badge>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  {project.description && (
                    <p className="truncate text-xs text-muted-foreground">{project.description}</p>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell className="px-3 py-3 align-top">
              <span className="text-sm capitalize">{project.role ?? 'member'}</span>
            </TableCell>
            <TableCell className="px-3 py-3 align-top">
              {project.permissions ? (
                <PermissionsPopover permissions={project.permissions} label="Your permissions" />
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="px-3 py-2 align-top">
              <div className="flex items-center justify-end gap-1">
                <ManageProjectsRowAction
                  icon={Copy}
                  label="Copy project"
                  onClick={() => onCopy(project)}
                />
                {project.role === 'owner' ? (
                  <ManageProjectsRowAction
                    icon={Trash2}
                    label="Delete project"
                    destructive
                    onClick={() => onDelete(project)}
                  />
                ) : (
                  <ManageProjectsRowAction
                    icon={LogOut}
                    label="Leave project"
                    destructive
                    onClick={() => onLeave(project)}
                  />
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
