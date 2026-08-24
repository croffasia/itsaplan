'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Cycle } from '@/lib/api';
import { CYCLE_STATUS_META } from '@/utils/cycleMeta';
import { colorDot } from '@/components/common/fields/colorDot';
import ProgressBar from '@/components/common/ProgressBar';
import CycleActions from '../CycleActions';
import CycleRange from '../CycleRange';
import TransferIssuesDialog from '../TransferIssuesDialog';

// The cycle detail header: name, the status its dates put it in, the range, and how
// much of it is done. Editing happens in the overflow menu dialog, and the transfer
// dialog is held here, the way the cycles table holds it.
export default function CycleHeader({ cycle, projectKey }: { cycle: Cycle; projectKey: string }) {
  const t = useTranslations('cycles');
  const status = CYCLE_STATUS_META[cycle.status];
  const [transferring, setTransferring] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b px-6 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{cycle.name}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {colorDot(status.color)}
          {t(`status.${cycle.status}`)}
        </span>
        <span className="text-xs text-muted-foreground">
          <CycleRange cycle={cycle} />
        </span>
        {cycle.goal && (
          <span className="max-w-md truncate text-xs text-muted-foreground">{cycle.goal}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <ProgressBar progress={cycle.progress} />
        <CycleActions
          cycle={cycle}
          projectKey={projectKey}
          onTransfer={() => setTransferring(true)}
        />
      </div>

      {transferring && (
        <TransferIssuesDialog
          cycle={cycle}
          projectKey={projectKey}
          onClose={() => setTransferring(false)}
        />
      )}
    </div>
  );
}
