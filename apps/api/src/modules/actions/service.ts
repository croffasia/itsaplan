import { isDeepStrictEqual } from 'node:util';
import { db, issue, projectAction } from '@repo/db';
import { and, eq, sql } from 'drizzle-orm';
import { HttpError, iso, num } from '#shared/lib';
import { assertIssueLabels, setIssueLabels, updateIssue } from '#modules/issues/service';
import { columnAutoAssignee } from '#modules/columns/service';
import { getAssignmentEligibility } from '#modules/members/service';
import { actionEffectValidator, type ActionEffect } from './model';

// Manual actions: saved macros on a project. condition is a filter set deciding
// which issues the action applies to (empty = always); effect is a partial issue
// patch. The saved definition is stored verbatim and validated when run.

export interface ActionRow {
  id: number;
  projectId: number;
  name: string;
  icon: string;
  condition: unknown;
  effect: unknown;
  position: number;
  createdAt: string;
}

function mapAction(row: typeof projectAction.$inferSelect): ActionRow {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    icon: row.icon,
    condition: row.condition,
    effect: row.effect,
    position: num(row.position),
    createdAt: iso(row.createdAt),
  };
}

export async function listActions(projectId: number): Promise<ActionRow[]> {
  const rows = await db
    .select()
    .from(projectAction)
    .where(eq(projectAction.projectId, projectId))
    .orderBy(projectAction.position, projectAction.id);
  return rows.map(mapAction);
}

// New actions go to the end of the list (max position + 1). condition/effect are
// stored verbatim in the jsonb columns.
export async function createAction(input: {
  projectId: number;
  name: string;
  icon?: string;
  condition?: unknown;
  effect?: unknown;
}): Promise<ActionRow> {
  const [{ pos }] = await db
    .select({ pos: sql<number>`COALESCE(MAX(${projectAction.position}) + 1, 0)` })
    .from(projectAction)
    .where(eq(projectAction.projectId, input.projectId));
  const [row] = await db
    .insert(projectAction)
    .values({
      projectId: input.projectId,
      name: input.name,
      icon: input.icon ?? '',
      condition: input.condition ?? {},
      effect: input.effect ?? {},
      position: Number(pos),
    })
    .returning();
  return mapAction(row);
}

export async function getAction(id: number): Promise<ActionRow | null> {
  const rows = await db.select().from(projectAction).where(eq(projectAction.id, id));
  return rows[0] ? mapAction(rows[0]) : null;
}

export async function applyAction(
  projectId: number,
  issueId: number,
  actionId: number,
  actorUserId: string,
  confirmedEffect: ActionEffect,
) {
  const action = await getAction(actionId);
  if (!action || action.projectId !== projectId) throw new HttpError(404, 'Action not found');
  const effect = actionEffectValidator.safeParse(action.effect);
  if (!effect.success) throw new HttpError(400, 'Invalid action effect');
  const [current] = await db
    .select({ columnId: issue.columnId })
    .from(issue)
    .where(and(eq(issue.id, issueId), eq(issue.projectId, projectId)));
  if (!current) throw new HttpError(404, 'Issue not found');

  const { assigneeUserId, ...otherFields } = effect.data;
  const effective: ActionEffect = otherFields;
  if (assigneeUserId !== undefined) {
    if (
      assigneeUserId === null ||
      (await getAssignmentEligibility(projectId, assigneeUserId)) === 'assignable'
    ) {
      effective.assigneeUserId = assigneeUserId;
    }
  } else if (effective.columnId !== undefined && effective.columnId !== current.columnId) {
    const autoAssignee = await columnAutoAssignee(projectId, effective.columnId);
    if (autoAssignee) effective.assigneeUserId = autoAssignee;
  }

  if (!isDeepStrictEqual(effective, confirmedEffect)) {
    throw new HttpError(
      409,
      'Action changes are out of date. Open the action again to review them.',
      'ACTION_EFFECT_CHANGED',
    );
  }

  const { labelIds, ...patch } = effective;
  await assertIssueLabels(projectId, labelIds);
  const updated = await updateIssue(issueId, patch, actorUserId, { skipAutoAssignee: true });
  if (!updated) throw new HttpError(404, 'Issue not found');
  if (labelIds) {
    await setIssueLabels(projectId, issueId, labelIds, actorUserId);
    updated.labelIds = labelIds;
  }
  return updated;
}

// Updates only the provided fields. condition/effect are replaced wholesale (not
// merged), since the UI always sends the full blob.
export async function updateAction(
  id: number,
  patch: { name?: string; icon?: string; condition?: unknown; effect?: unknown },
): Promise<ActionRow | null> {
  const set: Partial<typeof projectAction.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.icon !== undefined) set.icon = patch.icon;
  if (patch.condition !== undefined) set.condition = patch.condition;
  if (patch.effect !== undefined) set.effect = patch.effect;
  if (Object.keys(set).length === 0) return getAction(id);
  const [row] = await db.update(projectAction).set(set).where(eq(projectAction.id, id)).returning();
  return row ? mapAction(row) : null;
}

export async function deleteAction(id: number): Promise<void> {
  await db.delete(projectAction).where(eq(projectAction.id, id));
}

// Sets each action's position to its index in orderedIds, in one transaction, so
// the order the UI sends is stored exactly. Ids not on the project are ignored.
export async function reorderActions(
  projectId: number,
  orderedIds: number[],
): Promise<ActionRow[]> {
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx
        .update(projectAction)
        .set({ position })
        .where(and(eq(projectAction.id, id), eq(projectAction.projectId, projectId)));
    }
  });
  return listActions(projectId);
}
