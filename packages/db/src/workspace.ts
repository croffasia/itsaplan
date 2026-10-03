import { asc, eq } from 'drizzle-orm';
import type { DbExecutor } from './client';
import { team, workspace } from './schema';

// The workspace a self-hosted instance puts its teams in. Migration 0135 creates it.
export async function instanceWorkspaceId(executor: DbExecutor): Promise<number> {
  const [row] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .orderBy(asc(workspace.id))
    .limit(1);
  if (!row) throw new Error('The instance has no workspace');
  return row.id;
}

export async function teamWorkspaceId(teamId: number, executor: DbExecutor): Promise<number> {
  const [row] = await executor
    .select({ workspaceId: team.workspaceId })
    .from(team)
    .where(eq(team.id, teamId));
  if (!row) throw new Error(`Team ${teamId} does not exist`);
  return row.workspaceId;
}
