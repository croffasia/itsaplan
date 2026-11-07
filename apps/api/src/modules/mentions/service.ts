import { db, projectDocument } from '@repo/db';
import { and, eq, or } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import { hasPermission } from '#shared/permissions';
import type { MentionedUsers } from '#shared/mentions';
import { listAssigneeCandidates, listMemberContexts } from '#modules/members/service';
import { isAgentUser, listMentionTriggerAgents } from '#modules/agents/core/service';
import { enqueueAgentRun } from '#modules/agents/core/run-queue';

// Who a mention reaches, for every text that takes one. The fan-out of a comment or a
// text and the "@" menu both read mentionReach, so the menu offers exactly the people
// and agents a mention would reach.
//
// A comment addresses someone: a member is notified, and an agent that answers mentions
// is given a run. The text of an issue or a document names members for them to read
// it, so it reaches no agent. In a document a member must be able to read documents,
// and an agent also to comment on them, which its answer takes. A private document,
// which only its owner can open, reaches nobody.

export type MentionPlace = 'comment' | 'text';

export type MentionTarget =
  | { on: 'issue'; place: MentionPlace }
  | { on: 'document'; documentId: number; place: MentionPlace };

export interface MentionReach {
  memberIds: string[];
  agents: { id: number; userId: string }[];
}

// `users` are the project's members and agents a text names, or, for a reply, the
// author it answers among the agents.
export async function mentionReach(
  projectId: number,
  actorUserId: string | null,
  target: MentionTarget,
  users: MentionedUsers,
): Promise<MentionReach> {
  let { memberIds } = users;
  let agentUserIds = target.place === 'comment' ? users.agentUserIds : [];
  if (target.on === 'document') {
    const [document] = await db
      .select({ isPrivate: projectDocument.isPrivate })
      .from(projectDocument)
      .where(
        and(eq(projectDocument.id, target.documentId), eq(projectDocument.projectId, projectId)),
      );
    if (!document || document.isPrivate) return { memberIds: [], agents: [] };
    const contexts = await listMemberContexts(projectId);
    const may = (action: 'read' | 'edit') => (userId: string) => {
      const context = contexts.get(userId);
      return !!context && hasPermission(context.permissions, 'documents', action);
    };
    memberIds = memberIds.filter(may('read'));
    agentUserIds = agentUserIds.filter(may('edit'));
  }
  const agents = await listMentionTriggerAgents(projectId, agentUserIds, actorUserId);
  return { memberIds, agents };
}

export interface MentionCandidate {
  userId: string;
  name: string;
  username: string;
  kind: 'member' | 'agent';
}

// What the "@" menu offers the viewer at the target: everyone a mention written there
// would reach, the viewer left out. 404 for a document the viewer cannot open.
export async function listMentionCandidates(
  projectId: number,
  viewerId: string,
  target: MentionTarget,
): Promise<MentionCandidate[]> {
  if (target.on === 'document') {
    const [visible] = await db
      .select({ id: projectDocument.id })
      .from(projectDocument)
      .where(
        and(
          eq(projectDocument.id, target.documentId),
          eq(projectDocument.projectId, projectId),
          or(eq(projectDocument.isPrivate, false), eq(projectDocument.ownerUserId, viewerId)),
        ),
      );
    if (!visible) throw new HttpError(404, 'Document not found');
  }
  const named = (await listAssigneeCandidates(projectId)).filter(
    (candidate) => candidate.username && candidate.userId !== viewerId,
  );
  const reach = await mentionReach(projectId, viewerId, target, {
    memberIds: named.filter((c) => c.kind === 'member').map((c) => c.userId),
    agentUserIds: named.filter((c) => c.kind === 'agent').map((c) => c.userId),
  });
  const reached = new Set([...reach.memberIds, ...reach.agents.map((agent) => agent.userId)]);
  return named
    .filter((candidate) => reached.has(candidate.userId))
    .map(({ userId, name, username, kind }) => ({ userId, name, username: username!, kind }));
}

// Queues a run for each agent a comment reached. A comment an agent wrote starts no
// run, which stops agents from setting each other, or themselves, off.
export async function queueMentionRuns(input: {
  projectId: number;
  actorUserId: string | null;
  agents: MentionReach['agents'];
  prompt: string;
  source:
    | { issueId: number; sourceActivityId: number }
    | { documentId: number; sourceDocumentCommentId: string };
}): Promise<void> {
  if (input.agents.length === 0) return;
  if (input.actorUserId && (await isAgentUser(input.actorUserId))) return;
  for (const agent of input.agents) {
    await enqueueAgentRun({
      agentId: agent.id,
      projectId: input.projectId,
      issueId: null,
      sourceActivityId: null,
      ...input.source,
      prompt: input.prompt,
      trigger: 'mention',
    });
  }
}
