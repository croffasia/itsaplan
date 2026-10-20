'use client';

import { useTranslations } from 'next-intl';

export default function RunnerQueueNoRun() {
  const t = useTranslations('issue.agentRuns');
  return (
    <p className="hidden flex-1 items-center justify-center p-6 text-sm text-muted-foreground md:flex">
      {t('selectRun')}
    </p>
  );
}
