import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Clock3 } from 'lucide-react';
import type { AgentSchedule, AgentScheduleInput, ProjectDetail } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  useAgentSchedules,
  useCreateAgentSchedule,
  useDeleteAgentSchedule,
  useRunAgentSchedule,
  useUpdateAgentSchedule,
} from '@/services/agentSchedules.service';
import { settingsSection } from '@/utils/settingsSections';
import { useInternalAgents } from '../../hooks/useInternalAgents';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { SettingsListEmpty } from '../crud/SettingsListEmpty';
import { SettingsScheduleDialog } from './SettingsScheduleDialog';
import { SettingsScheduleRunsSheet } from './SettingsScheduleRunsSheet';
import { SettingsSchedulesTable } from './SettingsSchedulesTable';

const section = settingsSection('schedules');

export default function SettingsSchedules({
  project,
  requestNew,
  onNewHandled,
}: {
  project: ProjectDetail;
  requestNew: boolean;
  onNewHandled: () => void;
}) {
  const projectKey = project.project.key;
  const schedulesQuery = useAgentSchedules(projectKey);
  const agentsQuery = useInternalAgents(projectKey);
  const schedules = schedulesQuery.data ?? [];
  const agents = agentsQuery.agents;
  const createSchedule = useCreateAgentSchedule(projectKey);
  const updateSchedule = useUpdateAgentSchedule(projectKey);
  const deleteSchedule = useDeleteAgentSchedule(projectKey);
  const runSchedule = useRunAgentSchedule(projectKey);
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
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl bg-muted/30 px-6 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm">
          <AlertCircle className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium">Couldn&apos;t load schedules</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Check your connection and try again.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void Promise.all([agentsQuery.refetch(), schedulesQuery.refetch()])}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (agentsQuery.isLoading || schedulesQuery.isLoading) {
    return (
      <div
        className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground"
        aria-live="polite"
      >
        Loading schedules…
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl bg-muted/30 px-6 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm">
          <Clock3 className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium">No agents to schedule</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            A schedule runs a task for an internal agent. Create one first, then come back here.
          </p>
        </div>
        <Button size="sm" className="h-8" asChild>
          <Link href={`/project/${projectKey}/ai-agents`}>Create an agent</Link>
        </Button>
      </div>
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
        <SettingsListEmpty
          icon={section.icon}
          title="No schedules yet"
          description="Run an agent task automatically on a recurring UTC schedule."
        />
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
          title="Delete schedule"
          confirmLabel="Delete schedule"
          message={
            <>
              The schedule <span className="font-medium">{deleting.name}</span> and its run history
              will be removed. This cannot be undone.
            </>
          }
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
