import { db, issueChecklist, issueChecklistItem } from '@repo/db';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import { recordActivity, rowSide } from './activity';

// Checklists on an issue: a list of steps too small to be subtasks of their own.
// An issue holds several checklists, each holding its items; both are ordered by
// position within their parent.
//
// Activity is recorded for the structural changes (a checklist or an item added,
// renamed or removed) but never for checking a box: a toggle is the most frequent
// write there is here, and logging it would bury the rest of the feed.

export interface ChecklistItemRow {
  id: number;
  content: string;
  done: boolean;
  position: number;
}

export interface ChecklistRow {
  id: number;
  title: string;
  position: number;
  items: ChecklistItemRow[];
}

// The DTO columns, shared by the reads and by the writes that return the row they
// changed.
const checklistColumns = {
  id: issueChecklist.id,
  title: issueChecklist.title,
  position: issueChecklist.position,
};

const itemColumns = {
  id: issueChecklistItem.id,
  content: issueChecklistItem.content,
  done: issueChecklistItem.done,
  position: issueChecklistItem.position,
};

// The issue a checklist belongs to and its title, which the activity entries for
// its items carry as their subject. Throws when there is no such checklist.
async function checklistContext(checklistId: number): Promise<{ issueId: number; title: string }> {
  const rows = await db
    .select({ issueId: issueChecklist.issueId, title: issueChecklist.title })
    .from(issueChecklist)
    .where(eq(issueChecklist.id, checklistId));
  if (!rows[0]) throw new HttpError(404, 'Checklist not found');
  return rows[0];
}

// The issue a checklist hangs on, for the route guard that resolves it to a project.
export async function getChecklistIssueId(checklistId: number): Promise<number | null> {
  const rows = await db
    .select({ issueId: issueChecklist.issueId })
    .from(issueChecklist)
    .where(eq(issueChecklist.id, checklistId));
  return rows[0]?.issueId ?? null;
}

// The issue an item hangs on, through its checklist.
export async function getChecklistItemIssueId(itemId: number): Promise<number | null> {
  const rows = await db
    .select({ issueId: issueChecklist.issueId })
    .from(issueChecklistItem)
    .innerJoin(issueChecklist, eq(issueChecklist.id, issueChecklistItem.checklistId))
    .where(eq(issueChecklistItem.id, itemId));
  return rows[0]?.issueId ?? null;
}

// Every checklist of an issue with its items, both in display order. Two reads
// joined in memory rather than one row-multiplying join, so a checklist with no
// items still comes back.
export async function listChecklists(issueId: number): Promise<ChecklistRow[]> {
  const lists = await db
    .select(checklistColumns)
    .from(issueChecklist)
    .where(eq(issueChecklist.issueId, issueId))
    .orderBy(asc(issueChecklist.position), asc(issueChecklist.id));
  if (lists.length === 0) return [];

  const items = await db
    .select({
      id: issueChecklistItem.id,
      checklistId: issueChecklistItem.checklistId,
      content: issueChecklistItem.content,
      done: issueChecklistItem.done,
      position: issueChecklistItem.position,
    })
    .from(issueChecklistItem)
    .where(
      inArray(
        issueChecklistItem.checklistId,
        lists.map((list) => list.id),
      ),
    )
    .orderBy(asc(issueChecklistItem.position), asc(issueChecklistItem.id));

  const byChecklist = new Map<number, ChecklistItemRow[]>();
  for (const { checklistId, ...item } of items) {
    const bucket = byChecklist.get(checklistId);
    if (bucket) bucket.push(item);
    else byChecklist.set(checklistId, [item]);
  }
  return lists.map((list) => ({ ...list, items: byChecklist.get(list.id) ?? [] }));
}

export async function createChecklist(
  issueId: number,
  title: string,
  actorUserId?: string | null,
): Promise<ChecklistRow> {
  const [row] = await db
    .insert(issueChecklist)
    .values({
      issueId,
      title,
      // A sparse float, leaving room to insert between two rows without a renumber.
      position: sql<number>`(select coalesce(max(${issueChecklist.position}), 0) + 1000 from ${issueChecklist} where ${eq(issueChecklist.issueId, issueId)})`,
    })
    .returning(checklistColumns);

  await recordActivity(
    issueId,
    [{ action: 'checklist_add', to: rowSide(title, row.id) }],
    actorUserId,
  );
  return { ...row, items: [] };
}

export async function renameChecklist(
  checklistId: number,
  title: string,
  actorUserId?: string | null,
): Promise<ChecklistRow> {
  const previous = await checklistContext(checklistId);
  const [row] = await db
    .update(issueChecklist)
    .set({ title })
    .where(eq(issueChecklist.id, checklistId))
    .returning(checklistColumns);

  // Renaming to the title it already has is not a change worth a feed entry.
  if (previous.title !== title) {
    await recordActivity(
      previous.issueId,
      [
        {
          action: 'checklist_rename',
          from: rowSide(previous.title, checklistId),
          to: rowSide(title, checklistId),
        },
      ],
      actorUserId,
    );
  }
  return { ...row, items: await listItems(checklistId) };
}

// Deletes a checklist; its items go with it through the FK cascade. Returns false
// when there is no such checklist.
export async function deleteChecklist(
  checklistId: number,
  actorUserId?: string | null,
): Promise<boolean> {
  const [removed] = await db
    .delete(issueChecklist)
    .where(eq(issueChecklist.id, checklistId))
    .returning({ issueId: issueChecklist.issueId, title: issueChecklist.title });
  if (!removed) return false;

  await recordActivity(
    removed.issueId,
    [{ action: 'checklist_remove', from: rowSide(removed.title, checklistId) }],
    actorUserId,
  );
  return true;
}

// Sets the order of an issue's checklists to orderedIds. Ids that belong to another
// issue are not matched by the update, so they cannot be moved through it; ids the
// caller left out keep their position and sort after the ones it listed.
export async function reorderChecklists(
  issueId: number,
  orderedIds: number[],
): Promise<ChecklistRow[]> {
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx
        .update(issueChecklist)
        .set({ position })
        .where(and(eq(issueChecklist.id, id), eq(issueChecklist.issueId, issueId)));
    }
  });
  return listChecklists(issueId);
}

async function listItems(checklistId: number): Promise<ChecklistItemRow[]> {
  return db
    .select(itemColumns)
    .from(issueChecklistItem)
    .where(eq(issueChecklistItem.checklistId, checklistId))
    .orderBy(asc(issueChecklistItem.position), asc(issueChecklistItem.id));
}

export async function createChecklistItem(
  checklistId: number,
  content: string,
  actorUserId?: string | null,
): Promise<ChecklistItemRow> {
  const checklist = await checklistContext(checklistId);
  const [row] = await db
    .insert(issueChecklistItem)
    .values({
      checklistId,
      content,
      position: sql<number>`(select coalesce(max(${issueChecklistItem.position}), 0) + 1000 from ${issueChecklistItem} where ${eq(issueChecklistItem.checklistId, checklistId)})`,
    })
    .returning(itemColumns);

  await recordActivity(
    checklist.issueId,
    [
      {
        action: 'checklist_item_add',
        subject: rowSide(checklist.title, checklistId),
        to: rowSide(content, row.id),
      },
    ],
    actorUserId,
  );
  return row;
}

export async function updateChecklistItem(
  itemId: number,
  patch: { content?: string; done?: boolean },
): Promise<ChecklistItemRow> {
  // Both fields are optional, so a patch can carry neither. Drizzle rejects an
  // empty `set`, so read the item back instead of writing nothing.
  if (patch.content === undefined && patch.done === undefined) {
    const [current] = await db
      .select(itemColumns)
      .from(issueChecklistItem)
      .where(eq(issueChecklistItem.id, itemId));
    if (!current) throw new HttpError(404, 'Checklist item not found');
    return current;
  }

  const [row] = await db
    .update(issueChecklistItem)
    .set(patch)
    .where(eq(issueChecklistItem.id, itemId))
    .returning(itemColumns);
  if (!row) throw new HttpError(404, 'Checklist item not found');
  return row;
}

export async function deleteChecklistItem(
  itemId: number,
  actorUserId?: string | null,
): Promise<boolean> {
  const [removed] = await db
    .delete(issueChecklistItem)
    .where(eq(issueChecklistItem.id, itemId))
    .returning({
      checklistId: issueChecklistItem.checklistId,
      content: issueChecklistItem.content,
    });
  if (!removed) return false;

  const checklist = await checklistContext(removed.checklistId);
  await recordActivity(
    checklist.issueId,
    [
      {
        action: 'checklist_item_remove',
        subject: rowSide(checklist.title, removed.checklistId),
        from: rowSide(removed.content, itemId),
      },
    ],
    actorUserId,
  );
  return true;
}

// Sets the order of a checklist's items, scoped to that checklist the same way
// reorderChecklists is scoped to its issue.
export async function reorderChecklistItems(
  checklistId: number,
  orderedIds: number[],
): Promise<ChecklistItemRow[]> {
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx
        .update(issueChecklistItem)
        .set({ position })
        .where(and(eq(issueChecklistItem.id, id), eq(issueChecklistItem.checklistId, checklistId)));
    }
  });
  return listItems(checklistId);
}
