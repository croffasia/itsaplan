import { db, noteBoard } from '@repo/db';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { iso } from '../shared/lib';

// Note boards: a freeform canvas of sticky notes. canvas is a jsonb blob owned by
// the UI (React Flow nodes + edges + viewport); this layer stores and returns it
// without inspecting its shape. ownerUserId NULL is a public board (every member
// sees it); a set ownerUserId is a personal board only its owner sees.

export interface NoteBoardRow {
  id: number;
  projectId: number;
  ownerUserId: string | null;
  name: string;
  canvas: unknown;
  createdAt: string;
  updatedAt: string;
}

// The board without its canvas — what the board switcher and MRU tabs need. The
// canvas can be large, so the list omits it; the full board (with canvas) is
// fetched one at a time via getNoteBoard when a board is opened.
export type NoteBoardSummary = Omit<NoteBoardRow, 'canvas'>;

function mapNoteBoard(row: typeof noteBoard.$inferSelect): NoteBoardRow {
  return {
    id: row.id,
    projectId: row.projectId,
    ownerUserId: row.ownerUserId,
    name: row.name,
    canvas: row.canvas,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

// The boards a user may see in a project, paged for the switcher: every public
// board plus the user's own personal boards, optionally filtered by a name
// substring, most-recently-updated first. Canvas is omitted from the list.
export async function listNoteBoards(
  projectId: number,
  userId: string,
  opts: { q?: string; limit: number; offset: number },
): Promise<NoteBoardSummary[]> {
  const visible = and(
    eq(noteBoard.projectId, projectId),
    or(isNull(noteBoard.ownerUserId), eq(noteBoard.ownerUserId, userId)),
  );
  const where = opts.q ? and(visible, ilike(noteBoard.name, `%${opts.q}%`)) : visible;
  const rows = await db
    .select({
      id: noteBoard.id,
      projectId: noteBoard.projectId,
      ownerUserId: noteBoard.ownerUserId,
      name: noteBoard.name,
      createdAt: noteBoard.createdAt,
      updatedAt: noteBoard.updatedAt,
    })
    .from(noteBoard)
    .where(where)
    .orderBy(desc(noteBoard.updatedAt), noteBoard.id)
    .limit(opts.limit)
    .offset(opts.offset);
  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    ownerUserId: row.ownerUserId,
    name: row.name,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }));
}

export async function getNoteBoard(id: number): Promise<NoteBoardRow | null> {
  const [row] = await db.select().from(noteBoard).where(eq(noteBoard.id, id));
  return row ? mapNoteBoard(row) : null;
}

// ownerUserId set makes the board personal to that user; null makes it public.
export async function createNoteBoard(input: {
  projectId: number;
  ownerUserId: string | null;
  name: string;
  canvas?: unknown;
}): Promise<NoteBoardRow> {
  const [row] = await db
    .insert(noteBoard)
    .values({
      projectId: input.projectId,
      ownerUserId: input.ownerUserId,
      name: input.name,
      canvas: input.canvas ?? {},
    })
    .returning();
  return mapNoteBoard(row);
}

export async function updateNoteBoard(
  id: number,
  patch: { name?: string; canvas?: unknown; ownerUserId?: string | null },
): Promise<NoteBoardRow | null> {
  const [row] = await db
    .update(noteBoard)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(noteBoard.id, id))
    .returning();
  return row ? mapNoteBoard(row) : null;
}

export async function deleteNoteBoard(id: number): Promise<void> {
  await db.delete(noteBoard).where(eq(noteBoard.id, id));
}
