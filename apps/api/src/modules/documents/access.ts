import { db, projectDocument, projectDocumentMember } from '@repo/db';
import { and, eq, exists, or, sql } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import { listAccessCandidates, type AccessCandidate } from '#modules/members/service';

// Who may open a page: everyone for a public page, and for a private page its owner
// and the members it is shared with.
export function documentVisibleTo(userId: string) {
  return or(
    eq(projectDocument.isPrivate, false),
    eq(projectDocument.ownerUserId, userId),
    exists(
      db
        .select({ one: sql`1` })
        .from(projectDocumentMember)
        .where(
          and(
            eq(projectDocumentMember.documentId, projectDocument.id),
            eq(projectDocumentMember.userId, userId),
          ),
        ),
    ),
  );
}

// The project members a private page can be shared with. Agents are left out: an
// agent's tools run as the agent for anyone who may run it, so sharing a page with one
// would open the page to all of them.
export async function listDocumentAccessCandidates(projectId: number): Promise<AccessCandidate[]> {
  const candidates = await listAccessCandidates(projectId, 'documents');
  return candidates.filter((candidate) => candidate.kind === 'member');
}

// The list a page's owner asked for, as it is stored: without duplicates and without
// the owner. Adding someone who is not a project member, or whose role cannot read
// Docs, is refused. Someone already on the list who has since become one of those is
// dropped, so the owner can still save the list.
export async function sharedMemberIds(
  projectId: number,
  ownerUserId: string,
  requested: string[],
  current: string[],
): Promise<string[]> {
  const ids = [...new Set(requested)].filter((id) => id !== ownerUserId);
  if (ids.length === 0) return [];
  const candidates = await listDocumentAccessCandidates(projectId);
  const grantable = new Set(candidates.filter((c) => c.canAccess).map((c) => c.userId));
  if (ids.some((id) => !grantable.has(id) && !current.includes(id))) {
    throw new HttpError(400, 'A page can only be shared with project members who may read Docs');
  }
  return ids.filter((id) => grantable.has(id));
}
