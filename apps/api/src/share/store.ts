import { randomUUID } from 'node:crypto';
import { db, issue, projectView } from '@repo/db';
import { eq } from 'drizzle-orm';
import { getProjectById, type ProjectRow } from '../projects/store';
import { listColumns } from '../columns/store';
import { listIssueTypes } from '../issue-types/store';
import { listLabels, listLabelGroups } from '../labels/store';
import { listCustomFields } from '../custom-fields/store';
import { listAssigneeCandidates } from '../members/store';
import { getIssue, getIssueFieldValues, listIssues, type IssueRow } from '../issues/store';
import { listFeed, type FeedItemRow } from '../issues/activity';
import { applyFilters } from '../views/filters';

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
  issue: IssueRow & { fields: Awaited<ReturnType<typeof getIssueFieldValues>> };
  feed: FeedItemRow[];
}

export interface SharedViewBundle {
  project: ShareScaffold;
  view: { name: string; icon: string | null; filters: unknown; display: unknown };
  issues: IssueRow[];
}

async function buildScaffold(project: ProjectRow): Promise<ShareScaffold> {
  const [columns, issueTypes, labels, labelGroups, assignees, customFields] = await Promise.all([
    listColumns(project.id),
    listIssueTypes(project.id),
    listLabels(project.id),
    listLabelGroups(project.id),
    listAssigneeCandidates(project.id),
    listCustomFields(project.id, { allTypes: true }),
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

// The read-only feed shows the newest activity; a public share never paginates,
// so it is capped at the store's max page (100). An issue with more than that
// shows its latest 100 entries.
async function issueFeed(issueId: number): Promise<FeedItemRow[]> {
  const page = await listFeed(issueId, { limit: 100 });
  return page.items;
}

// Builds the read-only bundle for one issue, shared by the shared-issue page and
// a card opened from a shared board. keepShareToken keeps the issue's own share
// token in the bundle; it is meaningful only on the shared-issue page and stripped
// elsewhere, so a shared board never leaks its issues' individual tokens.
async function issueBundle(
  issueRow: IssueRow,
  keepShareToken: boolean,
): Promise<SharedIssueBundle> {
  const project = await getProjectById(issueRow.projectId);
  if (!project) throw new Error('project missing for shared issue');
  const [scaffold, fields, feed] = await Promise.all([
    buildScaffold(project),
    getIssueFieldValues(issueRow.id),
    issueFeed(issueRow.id),
  ]);
  return {
    project: scaffold,
    issue: { ...issueRow, shareToken: keepShareToken ? issueRow.shareToken : null, fields },
    feed,
  };
}

// --- Enable / revoke ------------------------------------------------------------

// Enables sharing for an issue. Idempotent: an already-shared issue keeps its
// token. Returns the token, or null if the issue does not exist.
export async function enableIssueShare(issueId: number): Promise<string | null> {
  const rows = await db
    .select({ token: issue.shareToken })
    .from(issue)
    .where(eq(issue.id, issueId));
  if (rows.length === 0) return null;
  if (rows[0].token) return rows[0].token;
  const token = randomUUID();
  await db.update(issue).set({ shareToken: token }).where(eq(issue.id, issueId));
  return token;
}

// Revokes sharing for an issue. Returns false if the issue does not exist.
export async function disableIssueShare(issueId: number): Promise<boolean> {
  const rows = await db
    .update(issue)
    .set({ shareToken: null })
    .where(eq(issue.id, issueId))
    .returning({ id: issue.id });
  return rows.length > 0;
}

export async function enableViewShare(viewId: number): Promise<string | null> {
  const rows = await db
    .select({ token: projectView.shareToken })
    .from(projectView)
    .where(eq(projectView.id, viewId));
  if (rows.length === 0) return null;
  if (rows[0].token) return rows[0].token;
  const token = randomUUID();
  await db.update(projectView).set({ shareToken: token }).where(eq(projectView.id, viewId));
  return token;
}

export async function disableViewShare(viewId: number): Promise<boolean> {
  const rows = await db
    .update(projectView)
    .set({ shareToken: null })
    .where(eq(projectView.id, viewId))
    .returning({ id: projectView.id });
  return rows.length > 0;
}

// --- Public reads ---------------------------------------------------------------

// The bundle for a shared issue link, or null if no issue carries the token.
export async function getSharedIssue(token: string): Promise<SharedIssueBundle | null> {
  const issueRow = await getIssue(await issueIdByToken(token));
  if (!issueRow) return null;
  return issueBundle(issueRow, true);
}

// The bundle for a shared view link, or null if no view carries the token.
export async function getSharedView(token: string): Promise<SharedViewBundle | null> {
  const rows = await db.select().from(projectView).where(eq(projectView.shareToken, token));
  const view = rows[0];
  if (!view) return null;
  const project = await getProjectById(view.projectId);
  if (!project) return null;
  const [scaffold, issues] = await Promise.all([buildScaffold(project), listIssues(project)]);
  // Apply the view's own filters here so the bundle carries only the issues the
  // view shows, not the whole project. A public link must not expose issues the
  // filter excludes.
  const visible = applyFilters(issues, view.filters, scaffold.columns);
  return {
    project: scaffold,
    view: { name: view.name, icon: view.icon, filters: view.filters, display: view.display },
    // A shared board never leaks its issues' own individual share tokens.
    issues: visible.map((i) => ({ ...i, shareToken: null })),
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
    .select({ projectId: projectView.projectId, filters: projectView.filters })
    .from(projectView)
    .where(eq(projectView.shareToken, token));
  if (rows.length === 0) return null;
  const project = await getProjectById(rows[0].projectId);
  if (!project) return null;
  const [columns, issues] = await Promise.all([listColumns(project.id), listIssues(project)]);
  const issueRow = applyFilters(issues, rows[0].filters, columns).find((i) => i.id === issueId);
  if (!issueRow) return null;
  return issueBundle(issueRow, false);
}

// Resolves an issue share token to its issue id, or 0 (never a real id) when
// unknown, so getIssue then returns null.
async function issueIdByToken(token: string): Promise<number> {
  const rows = await db.select({ id: issue.id }).from(issue).where(eq(issue.shareToken, token));
  return rows[0]?.id ?? 0;
}
