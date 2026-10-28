import type { RunnerQueueScope } from '@/lib/api/endpoints/runnerQueue';
import { runnerQueuePath, teamSectionPath, workspacePath } from '@/utils/paths';

export const projectQueueScope = (projectRef: string): RunnerQueueScope => ({
  api: `/projects/${projectRef}`,
  path: runnerQueuePath(projectRef),
});

export const teamQueueScope = (team: { id: number; ref: string }): RunnerQueueScope => ({
  api: `/teams/${team.id}`,
  path: teamSectionPath(team.ref, 'queue'),
  acrossProjects: true,
});

export const workspaceQueueScope = (workspaceId: number): RunnerQueueScope => ({
  api: `/workspaces/${workspaceId}`,
  path: workspacePath(workspaceId, 'queue'),
  acrossProjects: true,
});
