'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Initiative } from '@/lib/api';
import { initiativesPath } from '@/utils/paths';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeleteInitiative } from '@/services/initiatives.service';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EditInitiativeDialog from './EditInitiativeDialog';

// The initiative's overflow menu. Deleting returns to the initiatives list.
export default function InitiativeActions({
  initiative,
  projectKey,
}: {
  initiative: Initiative;
  projectKey: string;
}) {
  const { can } = usePermissions();
  const del = useDeleteInitiative(projectKey);
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const canEdit = can('initiatives', 'edit');
  const canDelete = can('initiatives', 'delete');
  if (!canEdit && !canDelete) return null;

  const remove = async () => {
    await del.mutateAsync(initiative.id);
    router.push(initiativesPath(projectKey));
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Initiative options"
            className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
          )}
          {canEdit && canDelete && <DropdownMenuSeparator />}
          {canDelete && (
            <DropdownMenuItem variant="destructive" onClick={() => void remove()}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {editing && (
        <EditInitiativeDialog
          initiative={initiative}
          projectKey={projectKey}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
