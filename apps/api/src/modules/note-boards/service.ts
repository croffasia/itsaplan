import { db, noteBoard, noteBoardMember } from '@repo/db';
import { and, desc, eq, exists, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { iso } from '#shared/lib';
import { hasPermission } from '#shared/permissions';
import { listAssigneeCandidates, listMemberContexts } from '#modules/members/service';

// Note boards: a freeform canvas of sticky notes. canvas is a jsonb blob owned by
// the UI (React Flow nodes + edges + viewport); this layer stores and returns it
// without inspecting its shape. ownerUserId NULL is a public board (every member
// sees it); a set ownerUserId is a board its owner sees, plus the members granted
// access in note_board_member. Only the creator (createdByUserId) may change that.

// The three states the UI offers, derived from the two columns above: a board with
// an owner and no granted members is private, one with granted members restricted.
type NoteBoardVisibility = 'public' | 'private' | 'restricted';

export interface NoteBoardRow {
  id: number;
  projectId: number;
  ownerUserId: string | null;
  createdByUserId: string | null;
  visibility: NoteBoardVisibility;
  memberIds: string[];
  name: string;
  canvas: unknown;
  createdAt: string;
  updatedAt: string;
}

// The board without its canvas or member list — what the board switcher and MRU
// tabs need. The canvas can be large, so the list omits it; the full board is
// fetched one at a time via getNoteBoard when a board is opened.
export type NoteBoardSummary = Omit<NoteBoardRow, 'canvas' | 'memberIds'>;

function visibilityOf(ownerUserId: string | null, hasMembers: boolean): NoteBoardVisibility {
  if (ownerUserId === null) return 'public';
  return hasMembers ? 'restricted' : 'private';
}

function mapNoteBoard(row: typeof noteBoard.$inferSelect, memberIds: string[]): NoteBoardRow {
  return {
    id: row.id,
    projectId: row.projectId,
    ownerUserId: row.ownerUserId,
    createdByUserId: row.createdByUserId,
    visibility: visibilityOf(row.ownerUserId, memberIds.length > 0),
    memberIds,
    name: row.name,
    canvas: row.canvas,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function memberIdsOf(boardId: number): Promise<string[]> {
  const rows = await db
    .select({ userId: noteBoardMember.userId })
    .from(noteBoardMember)
    .where(eq(noteBoardMember.boardId, boardId));
  return rows.map((r) => r.userId);
}

// The boards a user may see in a project, paged for the switcher: every public
// board, the user's own boards, and the private boards they were granted access
// to, optionally filtered by a name substring, most-recently-updated first.
export async function listNoteBoards(
  projectId: number,
  userId: string,
  opts: { q?: string; limit: number; offset: number },
): Promise<NoteBoardSummary[]> {
  const visible = and(
    eq(noteBoard.projectId, projectId),
    or(
      isNull(noteBoard.ownerUserId),
      eq(noteBoard.ownerUserId, userId),
      exists(
        db
          .select({ one: sql`1` })
          .from(noteBoardMember)
          .where(
            and(eq(noteBoardMember.boardId, noteBoard.id), eq(noteBoardMember.userId, userId)),
          ),
      ),
    ),
  );
  const where = opts.q ? and(visible, ilike(noteBoard.name, `%${opts.q}%`)) : visible;
  const rows = await db
    .select({
      id: noteBoard.id,
      projectId: noteBoard.projectId,
      ownerUserId: noteBoard.ownerUserId,
      createdByUserId: noteBoard.createdByUserId,
      name: noteBoard.name,
      createdAt: noteBoard.createdAt,
      updatedAt: noteBoard.updatedAt,
    })
    .from(noteBoard)
    .where(where)
    .orderBy(desc(noteBoard.updatedAt), noteBoard.id)
    .limit(opts.limit)
    .offset(opts.offset);

  if (rows.length === 0) return [];

  // Which of the listed boards are shared with someone, so each row can report its
  // visibility without loading the member ids themselves.
  const shared = await db
    .selectDistinct({ boardId: noteBoardMember.boardId })
    .from(noteBoardMember)
    .where(
      inArray(
        noteBoardMember.boardId,
        rows.map((r) => r.id),
      ),
    );
  const withMembers = new Set(shared.map((r) => r.boardId));

  return rows.map((row) => ({
    ...row,
    visibility: visibilityOf(row.ownerUserId, withMembers.has(row.id)),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }));
}

export async function getNoteBoard(id: number): Promise<NoteBoardRow | null> {
  const [row] = await db.select().from(noteBoard).where(eq(noteBoard.id, id));
  return row ? mapNoteBoard(row, await memberIdsOf(id)) : null;
}

export async function createNoteBoard(input: {
  projectId: number;
  ownerUserId: string | null;
  createdByUserId: string;
  name: string;
  canvas?: unknown;
}): Promise<NoteBoardRow> {
  const [row] = await db
    .insert(noteBoard)
    .values({
      projectId: input.projectId,
      ownerUserId: input.ownerUserId,
      createdByUserId: input.createdByUserId,
      name: input.name,
      canvas: input.canvas ?? {},
    })
    .returning();
  return mapNoteBoard(row, []);
}

// memberIds replaces the board's granted members as a whole; leave it out to keep
// them. It is only meaningful on a board with an owner — a public board is visible
// to everyone anyway, so the caller clears the list when making a board public.
export async function updateNoteBoard(
  id: number,
  patch: {
    name?: string;
    canvas?: unknown;
    ownerUserId?: string | null;
    memberIds?: string[];
  },
): Promise<NoteBoardRow | null> {
  const { memberIds, ...columns } = patch;
  const [row] = await db
    .update(noteBoard)
    .set({ ...columns, updatedAt: sql`now()` })
    .where(eq(noteBoard.id, id))
    .returning();
  if (!row) return null;
  if (memberIds) await replaceNoteBoardMembers(id, memberIds);
  return mapNoteBoard(row, memberIds ?? (await memberIdsOf(id)));
}

async function replaceNoteBoardMembers(boardId: number, userIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(noteBoardMember).where(eq(noteBoardMember.boardId, boardId));
    if (userIds.length) {
      await tx.insert(noteBoardMember).values(userIds.map((userId) => ({ boardId, userId })));
    }
  });
}

export async function deleteNoteBoard(id: number): Promise<void> {
  await db.delete(noteBoard).where(eq(noteBoard.id, id));
}

// Someone a restricted board can be shared with. `canAccess` is whether their role
// lets them read note boards at all: without it a grant would be pointless, since
// every board route still checks the permission matrix. An agent is listed too —
// its bot user is a project member — but reaching a board also needs the note board
// actions enabled on the agent.
export interface NoteBoardAccessCandidate {
  userId: string;
  name: string;
  image: string | null;
  kind: 'member' | 'agent';
  canAccess: boolean;
}

export async function listNoteBoardAccessCandidates(
  projectId: number,
): Promise<NoteBoardAccessCandidate[]> {
  const [candidates, contexts] = await Promise.all([
    listAssigneeCandidates(projectId),
    listMemberContexts(projectId),
  ]);
  return candidates.map((c) => {
    const permissions = contexts.get(c.userId)?.permissions;
    return {
      userId: c.userId,
      name: c.name,
      image: c.image,
      kind: c.kind,
      canAccess: permissions ? hasPermission(permissions, 'note_boards', 'read') : false,
    };
  });
}
