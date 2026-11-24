'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { RunnerQueueScope } from '@/lib/api/endpoints/runnerQueue';
import ListColumn from '@/components/common/page/ListColumn';
import RunnerQueueList from './components/RunnerQueueList';

export default function RunnerQueuePage({
  scope,
  children,
}: {
  scope: RunnerQueueScope;
  children: ReactNode;
}) {
  const params = useParams<{ runId?: string }>();
  const selectedId = params.runId ? Number(params.runId) : null;
  const t = useTranslations('issue.agentRuns');
  return (
    <div className="flex h-full min-h-0">
      <ListColumn
        storageKey="agentRuns:list:width"
        minWidth={384}
        resizeLabel={t('resizeList')}
        className={cn('md:border-e', selectedId != null && 'hidden md:flex')}
      >
        <h1 className="px-4 pt-4 text-base font-semibold">{t('queueTitle')}</h1>
        <RunnerQueueList scope={scope} selectedId={selectedId} />
      </ListColumn>
      {children}
    </div>
  );
}
