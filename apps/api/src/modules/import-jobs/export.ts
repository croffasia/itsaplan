import {
  db,
  project,
  projectColumn,
  label,
  cycle,
  issue,
  issueLabel,
  issueActivity,
  issueLink,
  user,
} from '@repo/db';
import { eq, and, inArray } from 'drizzle-orm';
import { HttpError } from '#shared/lib';

// A project's own data, read directly (no import_job involved) and shaped into a
// self-contained, human-readable snapshot: states/cycles/parents/relations are named,
// not id-referenced, and issues carry their own identifier ("MKT-42") rather than a
// database id, so the file reads sensibly opened on its own. No write-back target
// exists yet — this is a download, not round-tripping into anything.

export interface ExportedComment {
  authorName: string | null;
  authorEmail: string | null;
  body: string;
  createdAt: string;
  replyToIndex: number | null;
}

export interface ExportedRelation {
  kind: string;
  targetIdentifier: string;
}

export interface ExportedIssue {
  identifier: string;
  title: string;
  description: string;
  state: string;
  labels: string[];
  cycle: string | null;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  parentIdentifier: string | null;
  assigneeEmail: string | null;
  comments: ExportedComment[];
  relations: ExportedRelation[];
}

export interface ProjectExport {
  exportedAt: string;
  project: { key: string; name: string; description: string };
  states: { name: string; category: string }[];
  labels: { name: string; color: string }[];
  cycles: { name: string; startDate: string; endDate: string; goal: string }[];
  issues: ExportedIssue[];
}

export async function exportProject(projectId: number): Promise<ProjectExport> {
  const [projectRow] = await db
    .select({ key: project.key, name: project.name, description: project.description })
    .from(project)
    .where(eq(project.id, projectId));
  if (!projectRow) throw new HttpError(404, 'Project not found');

  const columns = await db
    .select({ id: projectColumn.id, name: projectColumn.name, category: projectColumn.stateType })
    .from(projectColumn)
    .where(eq(projectColumn.projectId, projectId));
  const columnNameById = new Map(columns.map((c) => [c.id, c.name]));

  const labelRows = await db
    .select({ id: label.id, name: label.name, color: label.color })
    .from(label)
    .where(eq(label.projectId, projectId));
  const labelNameById = new Map(labelRows.map((l) => [l.id, l.name]));

  const cycleRows = await db
    .select({
      id: cycle.id,
      name: cycle.name,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      goal: cycle.goal,
    })
    .from(cycle)
    .where(eq(cycle.projectId, projectId));
  const cycleNameById = new Map(cycleRows.map((c) => [c.id, c.name]));

  const issueRows = await db
    .select({
      id: issue.id,
      sequenceNumber: issue.sequenceNumber,
      title: issue.title,
      description: issue.description,
      columnId: issue.columnId,
      cycleId: issue.cycleId,
      parentId: issue.parentId,
      assigneeUserId: issue.assigneeUserId,
      priority: issue.priority,
      startDate: issue.startDate,
      dueDate: issue.dueDate,
    })
    .from(issue)
    .where(eq(issue.projectId, projectId))
    .orderBy(issue.sequenceNumber);
  const identifierByIssueId = new Map(
    issueRows.map((i) => [i.id, `${projectRow.key}-${i.sequenceNumber}`]),
  );
  const issueIds = issueRows.map((i) => i.id);

  const labelLinks = issueIds.length
    ? await db
        .select({ issueId: issueLabel.issueId, labelId: issueLabel.labelId })
        .from(issueLabel)
        .where(inArray(issueLabel.issueId, issueIds))
    : [];
  const labelsByIssueId = new Map<number, string[]>();
  for (const link of labelLinks) {
    const name = labelNameById.get(link.labelId);
    if (!name) continue;
    const names = labelsByIssueId.get(link.issueId);
    if (names) names.push(name);
    else labelsByIssueId.set(link.issueId, [name]);
  }

  const comments = issueIds.length
    ? await db
        .select({
          id: issueActivity.id,
          issueId: issueActivity.issueId,
          actorName: issueActivity.actorName,
          actorUserId: issueActivity.actorUserId,
          body: issueActivity.body,
          createdAt: issueActivity.createdAt,
          replyToId: issueActivity.replyToId,
        })
        .from(issueActivity)
        .where(and(inArray(issueActivity.issueId, issueIds), eq(issueActivity.kind, 'comment')))
        .orderBy(issueActivity.createdAt)
    : [];

  const relations = issueIds.length
    ? await db
        .select({
          sourceIssueId: issueLink.sourceIssueId,
          targetIssueId: issueLink.targetIssueId,
          kind: issueLink.kind,
        })
        .from(issueLink)
        .where(inArray(issueLink.sourceIssueId, issueIds))
    : [];
  const relationsBySourceId = new Map<number, typeof relations>();
  for (const relation of relations) {
    const forIssue = relationsBySourceId.get(relation.sourceIssueId);
    if (forIssue) forIssue.push(relation);
    else relationsBySourceId.set(relation.sourceIssueId, [relation]);
  }

  const userIds = [
    ...new Set(
      [...issueRows.map((i) => i.assigneeUserId), ...comments.map((c) => c.actorUserId)].filter(
        (id): id is string => id != null,
      ),
    ),
  ];
  const emailByUserId = userIds.length
    ? new Map(
        (
          await db
            .select({ id: user.id, email: user.email })
            .from(user)
            .where(inArray(user.id, userIds))
        ).map((u) => [u.id, u.email]),
      )
    : new Map<string, string>();

  const commentsByIssueId = new Map<number, typeof comments>();
  for (const comment of comments) {
    // issue_activity.issue_id is nullable in general (an activity can belong to an
    // initiative instead), but every row here was matched by inArray(..., issueIds).
    const issueId = comment.issueId!;
    const forIssue = commentsByIssueId.get(issueId);
    if (forIssue) forIssue.push(comment);
    else commentsByIssueId.set(issueId, [comment]);
  }

  const issues: ExportedIssue[] = issueRows.map((row) => {
    const issueComments = commentsByIssueId.get(row.id) ?? [];
    const commentIndexById = new Map(issueComments.map((c, index) => [c.id, index]));
    return {
      identifier: identifierByIssueId.get(row.id)!,
      title: row.title,
      description: row.description,
      state: columnNameById.get(row.columnId) ?? '',
      labels: labelsByIssueId.get(row.id) ?? [],
      cycle: row.cycleId != null ? (cycleNameById.get(row.cycleId) ?? null) : null,
      priority: row.priority,
      startDate: row.startDate,
      dueDate: row.dueDate,
      parentIdentifier:
        row.parentId != null ? (identifierByIssueId.get(row.parentId) ?? null) : null,
      assigneeEmail:
        row.assigneeUserId != null ? (emailByUserId.get(row.assigneeUserId) ?? null) : null,
      comments: issueComments.map((c) => ({
        authorName: c.actorName,
        authorEmail: c.actorUserId != null ? (emailByUserId.get(c.actorUserId) ?? null) : null,
        body: c.body ?? '',
        createdAt: c.createdAt.toISOString(),
        replyToIndex: c.replyToId != null ? (commentIndexById.get(c.replyToId) ?? null) : null,
      })),
      relations: (relationsBySourceId.get(row.id) ?? [])
        .map((r) => ({ kind: r.kind, targetIdentifier: identifierByIssueId.get(r.targetIssueId) }))
        .filter((r): r is ExportedRelation => r.targetIdentifier != null),
    };
  });

  return {
    exportedAt: new Date().toISOString(),
    project: projectRow,
    states: columns.map((c) => ({ name: c.name, category: c.category })),
    labels: labelRows.map((l) => ({ name: l.name, color: l.color })),
    cycles: cycleRows.map((c) => ({
      name: c.name,
      startDate: c.startDate,
      endDate: c.endDate,
      goal: c.goal,
    })),
    issues,
  };
}
