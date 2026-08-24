'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Cycle } from '@/lib/api';
import ShowMoreButton from '@/components/common/ShowMoreButton';
import { CYCLE_STATUS_META } from '@/utils/cycleMeta';
import type { CompletedCycles } from '../../hooks/useCompletedCycles';
import CycleTableSection from './CycleTableSection';
import CycleTableRow from './CycleTableRow';

// The finished cycles at the bottom of the table, newest first. The header carries
// how many there are in all, so the group says what it holds while folded; opening
// it shows the pages loaded so far and asks for the next one on demand. Unlike the
// planned groups, this one is not remembered: it starts folded every time, so what
// is running and what is next are what the table opens on.
export default function CycleTableArchive({
  completed,
  projectKey,
  gridTemplate,
  onTransfer,
}: {
  completed: CompletedCycles;
  projectKey: string;
  gridTemplate: string;
  onTransfer: (cycle: Cycle) => void;
}) {
  const t = useTranslations('cycles');
  const [collapsed, setCollapsed] = useState(true);
  const { color } = CYCLE_STATUS_META.completed;

  return (
    <>
      <CycleTableSection
        label={t('status.completed')}
        color={color}
        count={completed.total}
        collapsed={collapsed}
        onToggle={() => setCollapsed((folded) => !folded)}
      />
      {!collapsed && (
        <>
          {completed.items.map((cycle) => (
            <CycleTableRow
              key={cycle.id}
              cycle={cycle}
              projectKey={projectKey}
              gridTemplate={gridTemplate}
              onTransfer={onTransfer}
            />
          ))}
          {completed.hasMore && (
            <div className="px-4">
              <ShowMoreButton loading={completed.isLoadingMore} onClick={completed.loadMore} />
            </div>
          )}
        </>
      )}
    </>
  );
}
