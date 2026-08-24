'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightLeft,
  CircleCheck,
  MoreHorizontal,
  Pencil,
  SkipForward,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Cycle } from '@/lib/api';
import { cyclesPath } from '@/utils/paths';
import { usePermissions } from '@/hooks/usePermissions';
import { unfinishedCount } from '@/utils/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePlannedCyclesQuery } from '@/services/cycles.service';
import CycleFormDialog from './CycleFormDialog';
import DeleteCycleDialog from './DeleteCycleDialog';
import FinishCycleDialog from './FinishCycleDialog';
import StartNextCycleDialog from './StartNextCycleDialog';

// The cycle's overflow menu. Deleting returns to the cycles list; the issues of a
// deleted cycle stay, without one. Finishing a running cycle early and handing over
// to the next one are offered only while it runs — both are final.
//
// The transfer dialog is the caller's to render: finishing a cycle moves it into
// another group of the cycles list, which unmounts this menu along with anything it
// was showing. `onTransfer` asks for the dialog, both from the menu item and once a
// finish leaves unfinished issues behind.
export default function CycleActions({
  cycle,
  projectKey,
  onTransfer,
}: {
  cycle: Cycle;
  projectKey: string;
  onTransfer: (cycle: Cycle) => void;
}) {
  const t = useTranslations('cycles');
  const tCommon = useTranslations('common');
  const { can } = usePermissions();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [startingNext, setStartingNext] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The planned list is ordered by start date, so the first upcoming cycle is the
  // one "start next cycle today" hands over to.
  const next = (usePlannedCyclesQuery(projectKey).data ?? []).find((c) => c.status === 'upcoming');

  const canEdit = can('cycles', 'edit');
  const canDelete = can('cycles', 'delete');
  if (!canEdit && !canDelete) return null;
  const running = cycle.status === 'active';
  const unfinished = unfinishedCount(cycle.progress);

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
          {canEdit && unfinished > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onTransfer(cycle)}>
                <ArrowRightLeft className="size-4" />
                {t('transferIssues', { count: unfinished })}
              </DropdownMenuItem>
            </>
          )}
          {canEdit && running && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFinishing(true)}>
                <CircleCheck className="size-4" />
                {t('finish.action')}
              </DropdownMenuItem>
              {next && (
                <DropdownMenuItem onClick={() => setStartingNext(true)}>
                  <SkipForward className="size-4" />
                  {t('startNext.action')}
                </DropdownMenuItem>
              )}
            </>
          )}
          {canDelete && (
            <>
              {canEdit && <DropdownMenuSeparator />}
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                <Trash2 className="size-4" />
                {tCommon('delete')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {editing && (
        <CycleFormDialog cycle={cycle} projectKey={projectKey} onClose={() => setEditing(false)} />
      )}
      {finishing && (
        <FinishCycleDialog
          cycle={cycle}
          projectKey={projectKey}
          onClose={() => setFinishing(false)}
          onFinished={() => {
            if (unfinished > 0) onTransfer(cycle);
          }}
        />
      )}
      {startingNext && next && (
        <StartNextCycleDialog
          cycle={cycle}
          next={next}
          projectKey={projectKey}
          onClose={() => setStartingNext(false)}
        />
      )}
      {deleting && (
        <DeleteCycleDialog
          cycle={cycle}
          projectKey={projectKey}
          onClose={() => setDeleting(false)}
          onDeleted={() => router.push(cyclesPath(projectKey))}
        />
      )}
    </>
  );
}
