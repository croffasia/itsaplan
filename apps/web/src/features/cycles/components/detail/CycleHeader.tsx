'use client';

import type { Cycle } from '@/lib/api';
import { formatShortDate } from '@/utils/dates';
import { CYCLE_STATUS_META } from '@/utils/cycleMeta';
import { colorDot } from '@/components/common/fields/colorDot';
import ProgressBar from '@/components/common/ProgressBar';
import CycleActions from './CycleActions';

// The cycle detail header: name, the status its dates put it in, the range, and how
// much of it is done. Editing happens in the overflow menu dialog.
export default function CycleHeader({ cycle, projectKey }: { cycle: Cycle; projectKey: string }) {
  const status = CYCLE_STATUS_META[cycle.status];

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b px-6 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{cycle.name}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {colorDot(status.color)}
          {status.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatShortDate(cycle.startDate)} – {formatShortDate(cycle.endDate)}
        </span>
        {cycle.goal && (
          <span className="max-w-md truncate text-xs text-muted-foreground">{cycle.goal}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <ProgressBar progress={cycle.progress} />
        <CycleActions cycle={cycle} projectKey={projectKey} />
      </div>
    </div>
  );
}
