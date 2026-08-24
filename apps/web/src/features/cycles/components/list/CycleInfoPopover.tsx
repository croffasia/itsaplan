'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, Info } from 'lucide-react';
import type { Cycle } from '@/lib/api';
import { cyclePath } from '@/utils/paths';
import { CYCLE_STATUS_META } from '@/utils/cycleMeta';
import { colorDot } from '@/components/common/fields/colorDot';
import ProgressBar from '@/components/common/ProgressBar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import CycleRange from '../CycleRange';
import { cycleLength } from '../../utils/cycleDates';

// The cycle's name in the timeline's label column, opening what does not fit on the
// track: the goal, the range, and how far the work is. The info icon marks the name
// as something to click, since a bar next to it is dragged instead.
export default function CycleInfoPopover({
  cycle,
  projectKey,
}: {
  cycle: Cycle;
  projectKey: string;
}) {
  const t = useTranslations('cycles');
  const status = CYCLE_STATUS_META[cycle.status];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/name flex w-full min-w-0 items-center gap-2 text-left"
          title={t('details')}
        >
          {colorDot(status.color)}
          <span className="min-w-0 flex-1 truncate text-sm">{cycle.name}</span>
          <Info className="size-3.5 shrink-0 text-muted-foreground/50 group-hover/name:text-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" side="right" className="w-72 p-0 text-sm">
        <div className="flex flex-col gap-2 px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{cycle.name}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              {colorDot(status.color)}
              {t(`status.${cycle.status}`)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            <CycleRange cycle={cycle} /> · {cycleLength(cycle)}d
          </p>
        </div>

        <div className="border-t border-border px-3.5 py-3">
          <p className="text-xs font-medium text-muted-foreground">{t('goal')}</p>
          <p className="mt-1 text-xs leading-snug whitespace-pre-wrap">
            {cycle.goal || <span className="text-muted-foreground">{t('noGoal')}</span>}
          </p>
        </div>

        <div className="border-t border-border px-3.5 py-3">
          <p className="text-xs font-medium text-muted-foreground">{t('progress')}</p>
          <div className="mt-2">
            <ProgressBar progress={cycle.progress} wide />
          </div>
        </div>

        <Link
          href={cyclePath(projectKey, cycle.id)}
          className="flex items-center justify-between border-t border-border px-3.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t('openCycle')}
          <ArrowRight className="size-3.5" />
        </Link>
      </PopoverContent>
    </Popover>
  );
}
