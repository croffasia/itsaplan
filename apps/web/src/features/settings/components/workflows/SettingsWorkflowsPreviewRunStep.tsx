'use client';

import { Bot, Copy, ExternalLink, Maximize2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import SettingsWorkflowsPreviewStatus from './SettingsWorkflowsPreviewStatus';

const LABEL = 'text-xs font-medium text-muted-foreground';
const BOX = 'flex flex-col gap-4 rounded-lg bg-muted/50 px-3.5 py-3';

// The open step: how it went in its second round, what it got with the notes of the send
// back, and what it returned.
export default function SettingsWorkflowsPreviewRunStep() {
  const t = useTranslations('sections.previews.workflows');
  const lines = (widths: string[]) => (
    <div className="space-y-2">
      {widths.map((width, index) => (
        <Skeleton key={index} className="h-2.5" style={{ width }} />
      ))}
    </div>
  );

  return (
    <div className="hidden min-w-0 xl:block">
      <div className="flex h-12 items-center gap-3.5 bg-muted/30 px-4 text-[13px] whitespace-nowrap">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <Bot className="size-3.5" />
        </span>
        <Skeleton className="h-3 w-24 shrink-0" />
        <span className="flex shrink-0 items-center gap-1.5 font-medium">
          <SettingsWorkflowsPreviewStatus state="done" />
          {t('done')}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
          {t('round')}
          <span className="flex rounded-md bg-muted p-0.5 text-xs tabular-nums">
            <span className="grid h-5 w-6 place-items-center">1</span>
            <span className="grid h-5 w-6 place-items-center rounded-[4px] bg-card text-foreground">
              2
            </span>
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <Skeleton className="h-2.5 w-4/5" />
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          {t('fullLog')}
          <ExternalLink className="size-3" />
        </span>
      </div>
      <div className="grid grid-cols-2">
        <section className="flex min-w-0 flex-col gap-2 px-4 py-3">
          <p className={LABEL}>{t('got')}</p>
          <div className={BOX}>
            <div className="space-y-2">
              <p className="text-xs font-medium">{t('task')}</p>
              {lines(['90%', '60%'])}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium">{t('notes')}</p>
              {lines(['85%', '95%', '40%'])}
            </div>
          </div>
        </section>
        <section className="flex min-w-0 flex-col gap-2 px-4 py-3">
          <p className={`${LABEL} flex items-center justify-between`}>
            {t('returned')}
            <span className="flex gap-2.5">
              <Copy className="size-[13px]" />
              <Maximize2 className="size-[13px]" />
            </span>
          </p>
          <div className={BOX}>
            {lines(['95%', '80%', '90%', '35%'])}
            {lines(['85%', '60%'])}
          </div>
        </section>
      </div>
    </div>
  );
}
