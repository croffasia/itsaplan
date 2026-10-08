import {
  db,
  agentRun,
  customField,
  customFieldOption,
  issue,
  issueFieldOption,
  issueFieldValue,
  issueKeyAlias,
  issueLabel,
  issueLink,
  issueType,
  issueWatcher,
  label,
  project as projectTable,
  projectColumn,
  projectDocumentIssue,
  projectMember,
} from '@repo/db';
import { and, asc, eq, inArray, notInArray, or, sql } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import type { ProjectRow } from '#modules/projects/service';
import { assertWipLimit } from '#modules/columns/service';
import { getIssue, recordParentChange, type IssueRow } from './service';
import { recordActivity, textSide } from './activity';
import { recordStatusChange } from './status-history';
import { recordCycleChange } from './cycle-history';
import { emitIssueEvent } from './webhook-payload';
import { queueStatusRuns } from '#modules/agents/schedules/issue-runs';

// Moves an issue, with its subtasks, to another project of the same team. Column,
// type, labels and custom fields belong to one project, so they are matched by name
// in the target and dropped when there is no match. Links and documents must stay
// inside one project, so those that reach an issue left behind are removed.
export async function moveIssue(
  issueId: number,
  target: ProjectRow,
  columnId: number | undefined,
  actorUserId: string,
): Promise<IssueRow> {
  const [root] = await db
    .select({ id: issue.id, projectId: issue.projectId, parentId: issue.parentId })
    .from(issue)
    .where(eq(issue.id, issueId));
  if (!root) throw new HttpError(404, 'Issue not found');
  if (root.projectId === target.id)
    throw new HttpError(400, 'The issue is already in this project');
  const [source] = await db
    .select({ key: projectTable.key, teamId: projectTable.teamId })
    .from(projectTable)
    .where(eq(projectTable.id, root.projectId));
  if (source.teamId !== target.teamId)
    throw new HttpError(400, 'An issue can only move to a project of the same team');

  const moved = await db
    .select({
      id: issue.id,
      parentId: issue.parentId,
      sequenceNumber: issue.sequenceNumber,
      cycleId: issue.cycleId,
      assigneeUserId: issue.assigneeUserId,
      delegateUserId: issue.delegateUserId,
      columnName: projectColumn.name,
      stateType: projectColumn.stateType,
      typeName: issueType.name,
    })
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .leftJoin(issueType, eq(issueType.id, issue.typeId))
    .where(or(eq(issue.id, issueId), eq(issue.parentId, issueId)))
    .orderBy(sql`${issue.id} <> ${issueId}`, asc(issue.sequenceNumber));
  const movedIds = moved.map((r) => r.id);

  const columns = await db
    .select({ id: projectColumn.id, name: projectColumn.name, stateType: projectColumn.stateType })
    .from(projectColumn)
    .where(eq(projectColumn.projectId, target.id))
    .orderBy(asc(projectColumn.position));
  if (columns.length === 0) throw new HttpError(400, 'The target project has no columns');
  if (columnId !== undefined && !columns.some((c) => c.id === columnId))
    throw new HttpError(400, 'Column must belong to the target project');
  const mapColumn = (name: string, stateType: string) =>
    (
      columns.find((c) => c.name === name) ??
      columns.find((c) => c.stateType === stateType) ??
      columns[0]
    ).id;

  const types = await db
    .select({ id: issueType.id, name: issueType.name, isDefault: issueType.isDefault })
    .from(issueType)
    .where(eq(issueType.projectId, target.id));
  const defaultTypeId = types.find((t) => t.isDefault)?.id ?? null;
  const mapType = (name: string | null) => types.find((t) => t.name === name)?.id ?? defaultTypeId;

  const members = new Set(
    (
      await db
        .select({ userId: projectMember.userId })
        .from(projectMember)
        .where(eq(projectMember.projectId, target.id))
    ).map((r) => r.userId),
  );
  const member = (userId: string | null) => (userId && members.has(userId) ? userId : null);

  const plans = moved.map((r) => ({
    ...r,
    newColumnId:
      r.id === issueId && columnId !== undefined ? columnId : mapColumn(r.columnName, r.stateType),
    newTypeId: mapType(r.typeName),
  }));
  const perColumn = new Map<number, number>();
  for (const p of plans) perColumn.set(p.newColumnId, (perColumn.get(p.newColumnId) ?? 0) + 1);
  for (const [id, incoming] of perColumn) await assertWipLimit(id, incoming);

  const labels = await mapLabels(movedIds, target.id);
  const fields = await mapFields(movedIds, target.id);

  await db.transaction(async (tx) => {
    // Everything above was read without a lock. A concurrent move of the same issue, or
    // a subtask added since, would otherwise write over that state.
    const [locked] = await tx
      .select({ projectId: issue.projectId })
      .from(issue)
      .where(eq(issue.id, issueId))
      .for('update');
    const current = await tx
      .select({ id: issue.id })
      .from(issue)
      .where(or(eq(issue.id, issueId), eq(issue.parentId, issueId)));
    if (
      locked?.projectId !== root.projectId ||
      current.length !== movedIds.length ||
      current.some((r) => !movedIds.includes(r.id))
    )
      throw new HttpError(409, 'The issue changed while it was being moved; try again');

    const [seqRow] = await tx
      .update(projectTable)
      .set({ nextSequence: sql`next_sequence + ${moved.length}` })
      .where(eq(projectTable.id, target.id))
      .returning({ first: sql<number>`next_sequence - ${moved.length}` });
    await tx.insert(issueKeyAlias).values(
      moved.map((r) => ({
        projectId: root.projectId,
        sequenceNumber: r.sequenceNumber,
        issueId: r.id,
      })),
    );
    for (const [i, p] of plans.entries()) {
      const [posRow] = await tx
        .select({ pos: sql<number>`COALESCE(MAX(${issue.position}), 0) + 1000` })
        .from(issue)
        .where(eq(issue.columnId, p.newColumnId));
      await tx
        .update(issue)
        .set({
          projectId: target.id,
          sequenceNumber: Number(seqRow.first) + i,
          columnId: p.newColumnId,
          typeId: p.newTypeId,
          parentId: p.id === issueId ? null : p.parentId,
          cycleId: null,
          initiativeId: null,
          assigneeUserId: member(p.assigneeUserId),
          delegateUserId: member(p.delegateUserId),
          position: Number(posRow.pos),
          updatedAt: sql`now()`,
        })
        .where(eq(issue.id, p.id));
    }

    await tx.delete(issueLabel).where(inArray(issueLabel.issueId, movedIds));
    if (labels.length) await tx.insert(issueLabel).values(labels);

    await tx.delete(issueFieldOption).where(inArray(issueFieldOption.issueId, movedIds));
    if (fields.options.length) await tx.insert(issueFieldOption).values(fields.options);
    for (const v of fields.values) {
      if (v.fieldId === null) {
        await tx.delete(issueFieldValue).where(eq(issueFieldValue.id, v.id));
      } else {
        await tx
          .update(issueFieldValue)
          .set({
            fieldId: v.fieldId,
            ...(v.valueUserId ? { valueUserId: member(v.valueUserId) } : {}),
          })
          .where(eq(issueFieldValue.id, v.id));
      }
    }

    await tx
      .delete(issueLink)
      .where(
        or(
          and(
            inArray(issueLink.sourceIssueId, movedIds),
            notInArray(issueLink.targetIssueId, movedIds),
          ),
          and(
            inArray(issueLink.targetIssueId, movedIds),
            notInArray(issueLink.sourceIssueId, movedIds),
          ),
        ),
      );
    await tx.delete(projectDocumentIssue).where(inArray(projectDocumentIssue.issueId, movedIds));
    await tx
      .delete(issueWatcher)
      .where(
        and(inArray(issueWatcher.issueId, movedIds), notInArray(issueWatcher.userId, [...members])),
      );
    await tx
      .update(agentRun)
      .set({ status: 'canceled', finishedAt: sql`now()` })
      .where(and(inArray(agentRun.issueId, movedIds), eq(agentRun.status, 'pending')));
  });

  for (const p of plans) {
    await recordStatusChange([p.id], p.newColumnId);
    await recordCycleChange(p.id, p.cycleId, null);
    const after = (await getIssue(p.id))!;
    await recordActivity(
      p.id,
      [
        {
          action: 'moved',
          from: textSide(`${source.key}-${p.sequenceNumber}`),
          to: textSide(after.identifier),
        },
      ],
      actorUserId,
    );
    if (p.id === issueId && p.parentId !== null)
      await recordParentChange(p.id, p.parentId, null, actorUserId);
    await emitIssueEvent('issue.updated', after, actorUserId);
    await queueStatusRuns([p.id], p.newColumnId, actorUserId);
  }
  return (await getIssue(issueId))!;
}

// The target project's labels the moved issues carry, matched by name.
async function mapLabels(
  issueIds: number[],
  targetProjectId: number,
): Promise<{ issueId: number; labelId: number }[]> {
  const targetLabel = db
    .select({ id: label.id, name: label.name })
    .from(label)
    .where(eq(label.projectId, targetProjectId))
    .as('target_label');
  return db
    .select({ issueId: issueLabel.issueId, labelId: targetLabel.id })
    .from(issueLabel)
    .innerJoin(label, eq(label.id, issueLabel.labelId))
    .innerJoin(targetLabel, eq(targetLabel.name, label.name))
    .where(inArray(issueLabel.issueId, issueIds));
}

// Each custom field value of the moved issues paired with the target field of the
// same name and kind (null when there is none, or when another value of the issue
// already took it), and the select options re-pointed at the target field's option of
// the same value.
async function mapFields(issueIds: number[], targetProjectId: number) {
  const targetFields = await db
    .select({ id: customField.id, name: customField.name, fieldType: customField.fieldType })
    .from(customField)
    .where(eq(customField.projectId, targetProjectId));
  const findField = (name: string, fieldType: string) =>
    targetFields.find((f) => f.name === name && f.fieldType === fieldType)?.id ?? null;

  const valueRows = await db
    .select({
      id: issueFieldValue.id,
      issueId: issueFieldValue.issueId,
      name: customField.name,
      fieldType: customField.fieldType,
      valueUserId: issueFieldValue.valueUserId,
    })
    .from(issueFieldValue)
    .innerJoin(customField, eq(customField.id, issueFieldValue.fieldId))
    .where(inArray(issueFieldValue.issueId, issueIds));
  const taken = new Set<string>();
  const values = valueRows.map((v) => {
    const fieldId = findField(v.name, v.fieldType);
    const key = `${v.issueId}:${fieldId}`;
    if (fieldId === null || taken.has(key)) return { ...v, fieldId: null };
    taken.add(key);
    return { ...v, fieldId };
  });

  const optionRows = await db
    .select({
      issueId: issueFieldOption.issueId,
      name: customField.name,
      fieldType: customField.fieldType,
      value: customFieldOption.value,
    })
    .from(issueFieldOption)
    .innerJoin(customField, eq(customField.id, issueFieldOption.fieldId))
    .innerJoin(customFieldOption, eq(customFieldOption.id, issueFieldOption.optionId))
    .where(inArray(issueFieldOption.issueId, issueIds));
  const targetFieldIds = targetFields.map((f) => f.id);
  const targetOptions = targetFieldIds.length
    ? await db
        .select({
          id: customFieldOption.id,
          fieldId: customFieldOption.fieldId,
          value: customFieldOption.value,
        })
        .from(customFieldOption)
        .where(inArray(customFieldOption.fieldId, targetFieldIds))
    : [];
  const seen = new Set<string>();
  const options = optionRows.flatMap((o) => {
    const fieldId = findField(o.name, o.fieldType);
    const option = targetOptions.find((t) => t.fieldId === fieldId && t.value === o.value);
    if (fieldId === null || !option) return [];
    const key = `${o.issueId}:${option.id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ issueId: o.issueId, fieldId, optionId: option.id }];
  });
  return { values, options };
}
