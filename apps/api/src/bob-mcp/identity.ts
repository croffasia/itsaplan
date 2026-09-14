import { aiAgent, db } from '@repo/db';
import { and, eq } from 'drizzle-orm';
import { getMemberContext } from '../members/store';
import { getProjectByKey, type ProjectRow } from '../projects/store';
import { hasPermission, type PermissionResource, type Permissions } from '../shared/permissions';
import { BOB_ACTOR, BobMcpError } from './security';

export interface BobContext {
  project: ProjectRow;
  userId: string;
  permissions: Permissions;
}

export async function resolveBobContext(): Promise<BobContext> {
  const key = process.env.VEXOL_BOB_MCP_PROJECT_KEY;
  if (!key) throw new BobMcpError('forbidden', 'Service identity is not configured');
  const project = await getProjectByKey(key);
  if (!project || !project.mcpEnabled) {
    throw new BobMcpError('forbidden', 'Service identity is not available');
  }
  const [agent] = await db
    .select({ userId: aiAgent.userId })
    .from(aiAgent)
    .where(and(eq(aiAgent.projectId, project.id), eq(aiAgent.username, BOB_ACTOR)))
    .limit(1);
  if (!agent) throw new BobMcpError('forbidden', 'Service identity is not available');
  const membership = await getMemberContext(project.id, agent.userId);
  if (!membership) throw new BobMcpError('forbidden', 'Service identity is not available');
  return { project, userId: agent.userId, permissions: membership.permissions };
}

export function requireBobRead(context: BobContext, resource: PermissionResource): void {
  if (
    resource === 'leads' &&
    process.env.VEXOL_LEADS_PROJECT_KEY?.toLowerCase() !== context.project.key.toLowerCase()
  ) {
    throw new BobMcpError('forbidden', 'Resource is not available');
  }
  if (!hasPermission(context.permissions, resource, 'read')) {
    throw new BobMcpError('forbidden', 'Resource is not available');
  }
}
