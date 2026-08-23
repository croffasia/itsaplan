import { randomUUID } from 'node:crypto';
import { db, issue, projectView } from '@repo/db';
import { eq } from 'drizzle-orm';
import { getProjectById, type ProjectRow } from '#modules/projects/service';
import { listColumns } from '#modules/columns/service';
import { listIssueTypes } from '#modules/issue-types/service';
import { listLabels, listLabelGroups } from '#modules/labels/service';
import { listCustomFields } from '#modules/custom-fields/service';
import { listAssigneeCandidates } from '#modules/members/service';
import { getIssue, getIssueFieldValues, listIssues, type IssueRow } from '#modules/issues/service';
import { listFeed, type FeedItemRow } from '#modules/issues/activity';
import {
  attachBoardLinks,
  listIssueLinks,
  type BoardIssueLink,
  type IssueLinkRow,
} from '#modules/issues/links';
import { getParentRef, listSubtasks, type IssueRef } from '#modules/issues/subtasks';
import { applyFilters } from '#modules/views/filters';

// Public read-only sharing: an issue or a saved view carries an unguessable
// share_token that, when set, makes it readable without a session through the
// /share/* routes. Enabling sets the token; revoking clears it. The public reads
// return a self-contained bundle (project scaffold + the entity) so the read-only
// page needs no other authenticated call.

// The project scaffold a read-only page needs to render issues: the same shape as
// GET /projects/:projectKey minus the caller's viewer/permissions. Member emails
// are stripped — a public page shows names, never emails.
export interface ShareScaffold {
  project: ProjectRow;
  columns: Awaited<ReturnType<typeof listColumns>>;
  issueTypes: Awaited<ReturnType<typeof listIssueTypes>>;
  labels: Awaited<ReturnType<typeof listLabels>>;
  labelGroups: Awaited<ReturnType<typeof listLabelGroups>>;
  assignees: Array<{
    userId: string;
    name: string;
    image: string | null;
    kind: 'member' | 'agent';
    agentKind: 'external' | 'internal' | null;
  }>;
  customFields: Awaited<ReturnType<typeof listCustomFields>>;
}

export interface SharedIssueBundle {
  project: ShareScaffold;
  issue: IssueRow & {
    fields: Awaited<ReturnType<typeof getIssueFieldValues>>;
    links: IssueLinkRow[];
    parent: IssueRef | null;
    subtasks: IssueRef[];
  };
  feed: FeedItemRow[];
}

export interface SharedViewBundle {
  project: ShareScaffold;
  view: {
    name: string;
    icon: string | null;
    display: unknown;
    // Whether the link exposes the full issues or only the reduced payload (see
    // redactIssue).
    extended: boolean;
  };
  issues: (IssueRow & { links: BoardIssueLink[]; subtaskCount: number })[];
}

// The scaffold for a bundle. Without `extended` it carries only what the reduced
// issue payload can reference — the columns and issue types — so a link that hides
// the people, labels and custom fields does not name them in the scaffold either.
async function buildScaffold(project: ProjectRow, extended: boolean): Promise<ShareScaffold> {
  const [columns, issueTypes, labels, labelGroups, assignees, customFields] = await Promise.all([
    listColumns(project.id),
    listIssueTypes(project.id),
    extended ? listLabels(project.id) : [],
    extended ? listLabelGroups(project.id) : [],
    extended ? listAssigneeCandidates(project.id) : [],
    extended ? listCustomFields(project.id, { allTypes: true }) : [],
  ]);
  return {
    project,
    columns,
    issueTypes,
    labels,
    labelGroups,
    // Drop the email — a public page renders names and avatars only.
    assignees: assignees.map((a) => ({
      userId: a.userId,
      name: a.name,
      image: a.image,
      kind: a.kind,
      agentKind: a.agentKind,
    })),
    customFields,
  };
}

// Cuts an issue down to what a non-extended share exposes: its title, description,
// state, type, priority, dates, and its place among the other issues. The people on
// it, its planning (initiative, cycle), its labels and its custom field values stay
// private.
function redactIssue<T extends IssueRow>(row: T): T {
  return {
    ...row,
    initiative: null,
    cycle: null,
    assigneeUserId: null,
    delegateUserId: null,
    labelIds: [],
    fieldValues: [],
  };
}

// The read-only feed shows the newest activity; a public share never paginates,
// so it is capped at listFeed's max page (100). An issue with more than that
// shows its latest 100 entries.
async function issueFeed(issueId: number): Promise<FeedItemRow[]> {
  const page = await listFeed(issueId, { limit: 100 });
  return page.items;
}

// Builds the read-only bundle for one issue, shared by the shared-issue page and
// a card opened from a shared board. keepShareToken keeps the issue's own share
// token in the bundle; it is meaningful only on the shared-issue page and stripped
// elsewhere, so a shared board never leaks its issues' individual tokens.
// onlyIssueIds limits the relations and the subtask hierarchy to the issues a
// shared board shows, so they cannot name one its filter excludes.
async function issueBundle(
  issueRow: IssueRow,
  {
    keepShareToken,
    extended,
    onlyIssueIds,
  }: { keepShareToken: boolean; extended: boolean; onlyIssueIds?: Set<number> },
): Promise<SharedIssueBundle> {
  const project = await getProjectById(issueRow.projectId);
  if (!project) throw new Error('project missing for shared issue');
  const [scaffold, fields, feed, links, parent, subtasks] = await Promise.all([
    buildScaffold(project, extended),
    extended ? getIssueFieldValues(issueRow.id) : [],
    extended ? issueFeed(issueRow.id) : [],
    listIssueLinks(issueRow.id),
    getParentRef(issueRow.parentId),
    listSubtasks(issueRow.id),
  ]);
  const shown = (id: number) => !onlyIssueIds || onlyIssueIds.has(id);
  const visible = extended ? issueRow : redactIssue(issueRow);
  return {
    project: scaffold,
    issue: {
      ...visible,
      shareToken: keepShareToken ? issueRow.shareToken : null,
      shareExtended: keepShareToken && issueRow.shareExtended,
      fields,
      links: links.filter((link) => shown(link.issue.id)),
      parent: parent && shown(parent.id) ? parent : null,
      subtasks: subtasks.filter((subtask) => shown(subtask.id)),
    },
    feed,
  };
}

// --- Enable / revoke ------------------------------------------------------------

// Enables sharing for an issue. An already-shared issue keeps its token, so the
// same call also flips `extended` on a live link; omitting `extended` leaves how
// much the link exposes as it stands. Returns the token, or null if the issue does
// not exist.
export async function enableIssueShare(
  issueId: number,
  extended?: boolean,
): Promise<string | null> {
  const rows = await db
    .select({ token: issue.shareToken })
    .from(issue)
    .where(eq(issue.id, issueId));
  if (rows.length === 0) return null;
  const token = rows[0].token ?? randomUUID();
  await db
    .update(issue)
    .set({ shareToken: token, ...(extended === undefined ? {} : { shareExtended: extended }) })
    .where(eq(issue.id, issueId));
  return token;
}

// Revokes sharing for an issue. Returns false if the issue does not exist.
export async function disableIssueShare(issueId: number): Promise<boolean> {
  const rows = await db
    .update(issue)
    .set({ shareToken: null, shareExtended: false })
    .where(eq(issue.id, issueId))
    .returning({ id: issue.id });
  return rows.length > 0;
}

// Enables sharing for a view, the same way enableIssueShare does for an issue.
export async function enableViewShare(viewId: number, extended?: boolean): Promise<string | null> {
  const rows = await db
    .select({ token: projectView.shareToken })
    .from(projectView)
    .where(eq(projectView.id, viewId));
  if (rows.length === 0) return null;
  const token = rows[0].token ?? randomUUID();
  await db
    .update(projectView)
    .set({ shareToken: token, ...(extended === undefined ? {} : { shareExtended: extended }) })
    .where(eq(projectView.id, viewId));
  return token;
}

export async function disableViewShare(viewId: number): Promise<boolean> {
  const rows = await db
    .update(projectView)
    .set({ shareToken: null, shareExtended: false })
    .where(eq(projectView.id, viewId))
    .returning({ id: projectView.id });
  return rows.length > 0;
}

// --- Public reads ---------------------------------------------------------------

// The bundle for a shared issue link, or null if no issue carries the token.
export async function getSharedIssue(token: string): Promise<SharedIssueBundle | null> {
  const issueRow = await getIssue(await issueIdByToken(token));
  if (!issueRow) return null;
  return issueBundle(issueRow, {
    keepShareToken: true,
    extended: issueRow.shareExtended,
  });
}

// The bundle for a shared view link, or null if no view carries the token.
export async function getSharedView(token: string): Promise<SharedViewBundle | null> {
  const rows = await db.select().from(projectView).where(eq(projectView.shareToken, token));
  const view = rows[0];
  if (!view) return null;
  const project = await getProjectById(view.projectId);
  if (!project) return null;
  const [scaffold, issues] = await Promise.all([
    buildScaffold(project, view.shareExtended),
    listIssues(project),
  ]);
  // Apply the view's own filters here so the bundle carries only the issues the
  // view shows, not the whole project. A public link must not expose issues the
  // filter excludes.
  const visible = applyFilters(issues, view.filters, scaffold.columns);
  // The board renders relations and subtask counts on its cards, the same way the
  // authenticated board does. Both are counted over the issues the view shows, so a
  // card cannot name or count one its filter excludes.
  const shown = new Set(visible.map((i) => i.id));
  const subtaskCounts = new Map<number, number>();
  for (const row of visible)
    if (row.parentId !== null)
      subtaskCounts.set(row.parentId, (subtaskCounts.get(row.parentId) ?? 0) + 1);
  const cards = await attachBoardLinks(visible, project.id);
  return {
    project: scaffold,
    // The filters stay on the server: they can name assignees, labels and custom
    // field values a link without `extended` withholds, and the bundle already
    // carries only the issues they match.
    view: {
      name: view.name,
      icon: view.icon,
      display: view.display,
      extended: view.shareExtended,
    },
    // A shared board never leaks its issues' own individual share tokens.
    issues: cards.map((i) => ({
      ...(view.shareExtended ? i : redactIssue(i)),
      shareToken: null,
      links: i.links.filter((link) => shown.has(link.issueId)),
      subtaskCount: subtaskCounts.get(i.id) ?? 0,
    })),
  };
}

// The read-only detail of one issue opened from a shared board. Enforces that the
// issue is one the shared view actually shows: it must belong to the view's project
// and pass the view's filters, so the board token cannot open issues the filter
// excludes (nor archived issues, which listIssues omits). Null if the token is
// unknown or the issue is not on the shared board.
export async function getSharedViewIssue(
  token: string,
  issueId: number,
): Promise<SharedIssueBundle | null> {
  const rows = await db
    .select({
      projectId: projectView.projectId,
      filters: projectView.filters,
      extended: projectView.shareExtended,
    })
    .from(projectView)
    .where(eq(projectView.shareToken, token));
  if (rows.length === 0) return null;
  const project = await getProjectById(rows[0].projectId);
  if (!project) return null;
  const [columns, issues] = await Promise.all([listColumns(project.id), listIssues(project)]);
  const shown = applyFilters(issues, rows[0].filters, columns);
  const issueRow = shown.find((i) => i.id === issueId);
  if (!issueRow) return null;
  return issueBundle(issueRow, {
    keepShareToken: false,
    extended: rows[0].extended,
    onlyIssueIds: new Set(shown.map((i) => i.id)),
  });
}

// Resolves an issue share token to its issue id, or 0 (never a real id) when
// unknown, so getIssue then returns null.
async function issueIdByToken(token: string): Promise<number> {
  const rows = await db.select({ id: issue.id }).from(issue).where(eq(issue.shareToken, token));
  return rows[0]?.id ?? 0;
}
