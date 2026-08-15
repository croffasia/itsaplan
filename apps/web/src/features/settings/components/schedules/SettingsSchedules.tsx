import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AgentSchedule, AgentScheduleInput, ProjectDetail } from '@/lib/api';
import { aiAgentsPath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import {
  useAgentSchedules,
  useCancelAgentScheduleRuns,
  useCreateAgentSchedule,
  useDeleteAgentSchedule,
  useRunAgentSchedule,
  useUpdateAgentSchedule,
} from '@/services/agentSchedules.service';
import { useAiAgentsQuery } from '@/services/aiAgents.service';
import { useSettingsCan } from '../../context/settingsPermission';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { SettingsScheduleDialog } from './SettingsScheduleDialog';
import { SettingsScheduleRunsSheet } from './SettingsScheduleRunsSheet';
import { SettingsSchedulesTable } from './SettingsSchedulesTable';
import { useTranslations } from 'next-intl';

export default function SettingsSchedules({
  project,
  requestNew,
  onNewHandled,
}: {
  project: ProjectDetail;
  requestNew: boolean;
  onNewHandled: () => void;
}) {
  const t = useTranslations('settings.schedules');
  const projectKey = project.project.key;
  const can = useSettingsCan();
  const schedulesQuery = useAgentSchedules(projectKey);
  const agentsQuery = useAiAgentsQuery(projectKey);
  const schedules = schedulesQuery.data ?? [];
  const agents = agentsQuery.data ?? [];
  const createSchedule = useCreateAgentSchedule(projectKey);
  const updateSchedule = useUpdateAgentSchedule(projectKey);
  const deleteSchedule = useDeleteAgentSchedule(projectKey);
  const runSchedule = useRunAgentSchedule(projectKey);
  const cancelPendingRuns = useCancelAgentScheduleRuns(projectKey);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AgentSchedule | null>(null);
  const [history, setHistory] = useState<AgentSchedule | null>(null);

  // The "New schedule" button lives in the page header; opening is signalled here.
  useEffect(() => {
    if (!requestNew) return;
    setEditing('new');
    onNewHandled();
  }, [requestNew, onNewHandled]);

  if (agentsQuery.isError || schedulesQuery.isError) {
    return (
      <EmptyState title={t('loadFailed')} description={t('loadFailedHint')}>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void Promise.all([agentsQuery.refetch(), schedulesQuery.refetch()])}
        >
          {t('tryAgain')}
        </Button>
      </EmptyState>
    );
  }

  if (agentsQuery.isLoading || schedulesQuery.isLoading) {
    return <ListSkeleton rows={3} rowClassName="h-12" />;
  }

  if (agents.length === 0) {
    return (
      <EmptyState title={t('noAgents')} description={t('noAgentsHint')}>
        {can('edit') && (
          <Button size="sm" asChild>
            <Link href={aiAgentsPath(projectKey)}>{t('createAgent')}</Link>
          </Button>
        )}
      </EmptyState>
    );
  }

  const saving = createSchedule.isPending || updateSchedule.isPending;
  const editingSchedule =
    typeof editing === 'number' ? schedules.find((schedule) => schedule.id === editing) : undefined;
  const showEditor = editing === 'new' || editingSchedule != null;

  async function saveSchedule(value: AgentScheduleInput) {
    if (editing === 'new') {
      await createSchedule.mutateAsync(value);
    } else if (typeof editing === 'number') {
      await updateSchedule.mutateAsync({ id: editing, patch: value });
    }
    setEditing(null);
  }

  return (
    <>
      {schedules.length === 0 ? (
        <EmptyState title={t('empty')} description={t('emptyHint')} />
      ) : (
        <div className="space-y-4">
          <SettingsSchedulesTable
            schedules={schedules}
            runningId={runSchedule.isPending ? (runSchedule.variables ?? null) : null}
            onToggle={(schedule) =>
              updateSchedule.mutate({
                id: schedule.id,
                patch: { status: schedule.status === 'active' ? 'paused' : 'active' },
              })
            }
            onRun={(scheduleId) => runSchedule.mutate(scheduleId)}
            onCancelPending={(scheduleId) => cancelPendingRuns.mutate({ scheduleId })}
            onHistory={setHistory}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
        </div>
      )}

      {showEditor && (
        <SettingsScheduleDialog
          key={editingSchedule?.id ?? 'new'}
          projectKey={projectKey}
          agents={agents}
          initial={editingSchedule}
          saving={saving}
          onSave={saveSchedule}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <SettingsConfirmDeleteDialog
          title={t('delete')}
          confirmLabel={t('delete')}
          message={t.rich('deleteMessage', {
            name: deleting.name,
            v: (chunks) => <span className="font-medium">{chunks}</span>,
          })}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteSchedule.mutateAsync(deleting.id);
            setDeleting(null);
          }}
        />
      )}
      <SettingsScheduleRunsSheet
        projectKey={projectKey}
        schedule={history}
        onClose={() => setHistory(null)}
      />
    </>
  );
}
