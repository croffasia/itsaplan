'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Cycle } from '@/lib/api';
import { cyclesPath } from '@/utils/paths';
import { usePermissions } from '@/hooks/usePermissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteCycle } from '@/services/cycles.service';
import CycleFormDialog from './CycleFormDialog';
import TransferIssuesDialog from './TransferIssuesDialog';

// The cycle's overflow menu. Deleting returns to the cycles list; the issues of a
// deleted cycle stay, without one.
export default function CycleActions({ cycle, projectKey }: { cycle: Cycle; projectKey: string }) {
  const t = useTranslations('cycles');
  const tCommon = useTranslations('common');
  const { can } = usePermissions();
  const del = useDeleteCycle(projectKey);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const canEdit = can('cycles', 'edit');
  const canDelete = can('cycles', 'delete');
  if (!canEdit && !canDelete) return null;

  const remove = async () => {
    await del.mutateAsync(cycle.id);
    router.push(cyclesPath(projectKey));
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('options')}
            className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              {tCommon('edit')}
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem onClick={() => setTransferring(true)}>
              <ArrowRightLeft className="size-4" />
              {t('transferIssues')}
            </DropdownMenuItem>
          )}
          {canEdit && canDelete && <DropdownMenuSeparator />}
          {canDelete && (
            <DropdownMenuItem variant="destructive" onClick={() => void remove()}>
              <Trash2 className="size-4" />
              {tCommon('delete')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {editing && (
        <CycleFormDialog cycle={cycle} projectKey={projectKey} onClose={() => setEditing(false)} />
      )}
      {transferring && (
        <TransferIssuesDialog
          cycle={cycle}
          projectKey={projectKey}
          onClose={() => setTransferring(false)}
        />
      )}
    </>
  );
}
