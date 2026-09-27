import { db, issue, issueType, label, project, projectColumn, team, user } from '@repo/db';
import { eq, inArray } from 'drizzle-orm';
import { emitWebhookEvents } from '#modules/webhooks/emit';
import type { WebhookEventType } from '#modules/webhooks/service';
import { issueUrl, teamRef } from '#modules/teams/ref';
import type { ActivityActor, FeedItemRow } from './activity';
import type { IssueRow } from './service';

// Webhook payloads carry names next to ids: a receiver has no API session to resolve
// a column, user, type, or label id, and a message built from the payload needs the
// words. The ids stay in place, so the named fields are additive.

// A query per kind of id, skipped when there is nothing to look up.
function byIds<K, R>(ids: K[], query: (ids: K[]) => Promise<R[]>): Promise<R[]> {
  const unique = [...new Set(ids)];
  return unique.length ? query(unique) : Promise.resolve([]);
}

// The issue's page URL per project, keyed by project id.
async function projectUrls(
  projectIds: number[],
): Promise<Map<number, (seq: number) => string | null>> {
  const rows = await byIds(projectIds, (ids) =>
    db
      .select({ id: project.id, key: project.key, teamId: team.id, teamSlug: team.slug })
      .from(project)
      .innerJoin(team, eq(team.id, project.teamId))
      .where(inArray(project.id, ids)),
  );
  return new Map(
    rows.map((r) => [
      r.id,
      (seq: number) => issueUrl(teamRef({ id: r.teamId, slug: r.teamSlug }), r.key, seq) ?? null,
    ]),
  );
}

export async function issuePayloads(issues: IssueRow[]) {
  const [columns, users, types, labels, urls] = await Promise.all([
    byIds(
      issues.map((i) => i.columnId),
      (ids) =>
        db
          .select({ id: projectColumn.id, name: projectColumn.name, type: projectColumn.stateType })
          .from(projectColumn)
          .where(inArray(projectColumn.id, ids)),
    ),
    byIds(
      issues.flatMap((i) => [i.assigneeUserId, i.delegateUserId]).filter((id) => id !== null),
      (ids) => db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ids)),
    ),
    byIds(
      issues.map((i) => i.typeId).filter((id) => id !== null),
      (ids) =>
        db
          .select({ id: issueType.id, name: issueType.name })
          .from(issueType)
          .where(inArray(issueType.id, ids)),
    ),
    byIds(
      issues.flatMap((i) => i.labelIds),
      (ids) =>
        db
          .select({ id: label.id, name: label.name, color: label.color })
          .from(label)
          .where(inArray(label.id, ids)),
    ),
    projectUrls(issues.map((i) => i.projectId)),
  ]);
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const typeById = new Map(types.map((t) => [t.id, t]));
  const labelById = new Map(labels.map((l) => [l.id, l]));
  const person = (id: string | null) => (id ? (userById.get(id) ?? { id, name: null }) : null);

  return issues.map((i) => ({
    ...i,
    url: urls.get(i.projectId)?.(i.sequenceNumber) ?? null,
    state: columnById.get(i.columnId) ?? null,
    assignee: person(i.assigneeUserId),
    delegate: person(i.delegateUserId),
    issueType: i.typeId === null ? null : (typeById.get(i.typeId) ?? null),
    labels: i.labelIds.flatMap((id) => labelById.get(id) ?? []),
  }));
}

// Emits one issue event per issue. The payloads are built only when a webhook of the
// project subscribes to eventType.
export async function emitIssueEvents(
  projectId: number,
  eventType: WebhookEventType,
  load: () => Promise<IssueRow[]>,
  actor: ActivityActor,
): Promise<void> {
  await emitWebhookEvents(projectId, eventType, async () => issuePayloads(await load()), actor);
}

export async function emitIssueEvent(
  eventType: WebhookEventType,
  row: IssueRow,
  actor: ActivityActor,
): Promise<void> {
  await emitIssueEvents(row.projectId, eventType, async () => [row], actor);
}

// A comment payload names the issue it is on, so a receiver can link to it.
export async function emitCommentEvent(
  projectId: number,
  eventType: WebhookEventType,
  comment: FeedItemRow,
  actor: ActivityActor,
): Promise<void> {
  await emitWebhookEvents(
    projectId,
    eventType,
    async () => {
      const [row] = await db
        .select({
          seq: issue.sequenceNumber,
          title: issue.title,
          key: project.key,
          teamId: team.id,
          teamSlug: team.slug,
        })
        .from(issue)
        .innerJoin(project, eq(project.id, issue.projectId))
        .innerJoin(team, eq(team.id, project.teamId))
        .where(eq(issue.id, comment.issueId));
      return [
        {
          ...comment,
          issue: row
            ? {
                id: comment.issueId,
                identifier: `${row.key}-${row.seq}`,
                title: row.title,
                url:
                  issueUrl(teamRef({ id: row.teamId, slug: row.teamSlug }), row.key, row.seq) ??
                  null,
              }
            : null,
        },
      ];
    },
    actor,
  );
}
