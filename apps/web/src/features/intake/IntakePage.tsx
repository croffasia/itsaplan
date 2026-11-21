'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { usePaging } from '@/hooks/usePaging';
import { revScope } from '@/utils/revScopes';
import type { IntakeStatus } from '@/lib/api/endpoints/intake';
import {
  intakeKeys,
  useIntakeMutations,
  useIntakeRequestsQuery,
  useIntakeSummaryQuery,
} from '@/services/intake.service';
import { Button } from '@/components/ui/button';
import ListPager from '@/components/common/ListPager';
import IntakeCreateDialog from './components/IntakeCreateDialog';
import IntakeDetailPanel from './components/IntakeDetailPanel';
import IntakeRequestRow from './components/IntakeRequestRow';
import { formatWaitingAge } from './utils/formatWaitingAge';

const STATUS_TABS: (IntakeStatus | 'all')[] = [
  'pending',
  'snoozed',
  'accepted',
  'declined',
  'duplicate',
  'all',
];

export default function IntakePage() {
  const t = useTranslations('intake');
  const { project } = useShell();
  const { can } = usePermissions();
  const [status, setStatus] = useState<IntakeStatus | 'all'>('pending');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const paging = usePaging();

  const projectRef = project?.project.ref ?? null;
  const projectId = project?.project.id ?? null;

  useDocumentTitle(t('title'));
  useLiveRefresh({
    scope: projectId ? revScope.intake(projectId) : null,
    targets: projectRef ? [intakeKeys.all(projectRef)] : [],
  });

  const summary = useIntakeSummaryQuery(projectRef);
  const list = useIntakeRequestsQuery(projectRef, {
    status,
    ...paging.params,
  });
  const mutations = useIntakeMutations(projectRef ?? '');

  if (!project || !projectRef) return null;

  const items = list.data?.items ?? [];
  const waitingCount = summary.data?.pendingCount ?? 0;
  const oldestAge =
    summary.data?.oldestPendingAgeMs != null
      ? formatWaitingAge(summary.data.oldestPendingAgeMs)
      : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{t('title')}</h1>
          <span className="text-xs text-muted-foreground">
            {oldestAge
              ? t('summaryWithOldest', { count: waitingCount, age: oldestAge })
              : t('summaryWaiting', { count: waitingCount })}
          </span>
        </div>
        {can('intake', 'create') && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="me-1.5 size-3.5" />
            {t('newRequest')}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1 border-b px-4 py-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab}
            size="sm"
            variant={status === tab ? 'secondary' : 'ghost'}
            onClick={() => {
              setStatus(tab);
              setSelectedId(null);
              paging.reset();
            }}
          >
            {t(`status.${tab}`)}
          </Button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-96 shrink-0 flex-col border-e">
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">{t('empty')}</div>
            ) : (
              items.map((req) => (
                <IntakeRequestRow
                  key={req.id}
                  request={req}
                  selected={selectedId === req.id}
                  onSelect={() => setSelectedId(req.id)}
                />
              ))
            )}
          </div>
          {list.data && list.data.total > list.data.pageSize && (
            <div className="border-t p-2">
              <ListPager paging={paging} total={list.data.total} />
            </div>
          )}
        </div>

        {selectedId != null ? (
          <IntakeDetailPanel
            projectRef={projectRef}
            projectKey={project.project.key}
            requestId={selectedId}
            assignees={project.assignees}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {t('selectRequest')}
          </div>
        )}
      </div>

      <IntakeCreateDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={(input) => mutations.create.mutateAsync(input)}
        pending={mutations.create.isPending}
      />
    </div>
  );
}
