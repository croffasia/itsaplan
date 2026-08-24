'use client';

import { Fragment, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Cycle } from '@/lib/api';
import { usePersistedSet } from '@/hooks/usePersistedSet';
import { groupCycles } from '../../utils/cycleGroups';
import type { CompletedCycles } from '../../hooks/useCompletedCycles';
import TransferIssuesDialog from '../TransferIssuesDialog';
import CycleTableSection from './CycleTableSection';
import CycleTableRow from './CycleTableRow';
import CycleTableArchive from './CycleTableArchive';

// The header row and every cycle row share this template, so the labels line up
// with the cells below them.
const GRID = 'minmax(200px,1fr) 200px 60px 56px 132px 32px';

// The project's cycles as one table: the planned ones grouped by the status their
// dates put them in, then the archive of the finished ones. Each planned group folds
// away, and which ones are folded is remembered per project.
//
// The transfer dialog is held here rather than in the row that asked for it: a cycle
// finished from its menu moves to another group, and the row it was on is gone by
// the time the dialog would open.
export default function CyclesTable({
  cycles,
  completed,
  projectKey,
}: {
  cycles: Cycle[];
  completed: CompletedCycles;
  projectKey: string;
}) {
  const t = useTranslations('cycles');
  const collapsed = usePersistedSet(`cycles-collapsed:${projectKey}`);
  const [transferring, setTransferring] = useState<Cycle | null>(null);

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[760px]">
        <div
          className="sticky top-0 z-10 grid items-center gap-3 border-b bg-background px-4 py-2 text-xs font-medium text-muted-foreground"
          style={{ gridTemplateColumns: GRID }}
        >
          <span>{t('columns.name')}</span>
          <span>{t('columns.dates')}</span>
          <span>{t('columns.length')}</span>
          <span>{t('columns.issues')}</span>
          <span>{t('columns.progress')}</span>
          <span />
        </div>

        {groupCycles(cycles).map((group) => {
          const isCollapsed = collapsed.values.has(group.status);
          return (
            <Fragment key={group.status}>
              <CycleTableSection
                label={t(`status.${group.status}`)}
                color={group.color}
                count={group.cycles.length}
                collapsed={isCollapsed}
                onToggle={() => collapsed.toggle(group.status)}
              />
              {!isCollapsed &&
                group.cycles.map((cycle) => (
                  <CycleTableRow
                    key={cycle.id}
                    cycle={cycle}
                    projectKey={projectKey}
                    gridTemplate={GRID}
                    onTransfer={setTransferring}
                  />
                ))}
            </Fragment>
          );
        })}

        {completed.total > 0 && (
          <CycleTableArchive
            completed={completed}
            projectKey={projectKey}
            gridTemplate={GRID}
            onTransfer={setTransferring}
          />
        )}
      </div>

      {transferring && (
        <TransferIssuesDialog
          cycle={transferring}
          projectKey={projectKey}
          onClose={() => setTransferring(null)}
        />
      )}
    </div>
  );
}
