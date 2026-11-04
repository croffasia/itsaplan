import { randomUUID } from 'node:crypto';
import { db, documentAsset, issue, projectColumn, projectDocument, projectView } from '@repo/db';
import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  type AnyColumn,
  type SQL,
} from 'drizzle-orm';
import { HttpError, iso, shareLive } from '#shared/lib';
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
import { revokedDocumentShare, rewriteAssetUrls } from '#modules/documents/service';

// Public read-only sharing: an issue, a saved view or a document carries an unguessable
// share_token that, when set, makes it readable without a session through the
// /share/* routes. Enabling sets the token; revoking clears it. The public reads
// return a self-contained bundle (project scaffold + the entity) so the read-only
// page needs no other authenticated call.

// The project scaffold a read-only page needs to render issues: the same shape as
// GET /projects/:projectKey minus the caller's viewer/permissions. Member emails
// are stripped — a public page shows names, never emails — and so is the team the
// project belongs to, whose name is the owner's username.
export interface ShareScaffold {
  project: Omit<ProjectRow, 'teamId' | 'teamName'>;
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
  const { teamId: _teamId, teamName: _teamName, ...publicProject } = project;
  return {
    project: publicProject,
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

// --- Expiry ---------------------------------------------------------------------

// A link can carry an expiry. Past it the link is dead: the public reads no longer
// match its token, the issue and the view report themselves as not shared, and the
// expiry sweep clears the token for good. Enabling it again issues a fresh token, so
// a link that has expired never comes back to life.

// How the enable call changes the expiry: a moment, null for never, or undefined to
// leave it as it stands (the same convention as `extended`).
export type ShareExpiry = Date | null | undefined;

// The SQL form of shareLive for a token lookup.
function activeShare(expiresAt: AnyColumn): SQL {
  return or(isNull(expiresAt), gt(expiresAt, new Date()))!;
}

// Clears the token of every share whose expiry has passed. Returns how many links
// it revoked. Runs from the api's background loop.
export async function sweepExpiredShares(): Promise<number> {
  const now = new Date();
  const [issues, views, documents] = await Promise.all([
    db
      .update(issue)
      .set({ shareToken: null, shareExtended: false, shareExpiresAt: null })
      .where(and(isNotNull(issue.shareToken), lte(issue.shareExpiresAt, now)))
      .returning({ id: issue.id }),
    db
      .update(projectView)
      .set({ shareToken: null, shareExtended: false, shareExpiresAt: null })
      .where(and(isNotNull(projectView.shareToken), lte(projectView.shareExpiresAt, now)))
      .returning({ id: projectView.id }),
    db
      .update(projectDocument)
      .set(revokedDocumentShare)
      .where(and(isNotNull(projectDocument.shareToken), lte(projectDocument.shareExpiresAt, now)))
      .returning({ id: projectDocument.id }),
  ]);
  return issues.length + views.length + documents.length;
}

// --- Enable / revoke ------------------------------------------------------------

export interface ShareState {
  token: string;
  expiresAt: string | null;
}

// Enables sharing for an issue. An already-shared issue keeps its token, so the
// same call also flips `extended` or moves the expiry of a live link; omitting
// either leaves it as it stands. An expired link is replaced by a fresh token and
// starts without an expiry unless one is given. Returns the token and expiry, or
// null if the issue does not exist.
export async function enableIssueShare(
  issueId: number,
  extended?: boolean,
  expiresAt?: ShareExpiry,
): Promise<ShareState | null> {
  const rows = await db
    .select({ token: issue.shareToken, expiresAt: issue.shareExpiresAt })
    .from(issue)
    .where(eq(issue.id, issueId));
  if (rows.length === 0) return null;
  const next = nextShare(rows[0], extended, expiresAt);
  await db
    .update(issue)
    .set({ shareToken: next.token, shareExpiresAt: next.expiresAt, shareExtended: next.choice })
    .where(eq(issue.id, issueId));
  return next.state;
}

// What an enable call writes, shared by issues, views and documents: the token, the
// expiry, and the link's choice (`extended`, or a document's `includeChildren`).
// An undefined choice leaves the column as it stands. `live` tells a caller with a
// second choice whether the link is new (see nextChoice).
function nextShare(
  current: { token: string | null; expiresAt: Date | null },
  choice: boolean | undefined,
  expiresAt: ShareExpiry,
): {
  token: string;
  expiresAt: Date | null;
  choice: boolean | undefined;
  live: boolean;
  state: ShareState;
} {
  const live = current.token !== null && shareLive(current.expiresAt);
  const token = live ? current.token! : randomUUID();
  let expiry: Date | null = null;
  if (expiresAt !== undefined) expiry = expiresAt;
  else if (live) expiry = current.expiresAt;
  return {
    token,
    expiresAt: expiry,
    choice: nextChoice(choice, live),
    live,
    state: { token, expiresAt: expiry ? iso(expiry) : null },
  };
}

// A fresh link starts with a choice off unless the caller turns it on.
function nextChoice(choice: boolean | undefined, live: boolean): boolean | undefined {
  return choice ?? (live ? undefined : false);
}

// Revokes sharing for an issue. Returns false if the issue does not exist.
export async function disableIssueShare(issueId: number): Promise<boolean> {
  const rows = await db
    .update(issue)
    .set({ shareToken: null, shareExtended: false, shareExpiresAt: null })
    .where(eq(issue.id, issueId))
    .returning({ id: issue.id });
  return rows.length > 0;
}

// Enables sharing for a view, the same way enableIssueShare does for an issue.
export async function enableViewShare(
  viewId: number,
  extended?: boolean,
  expiresAt?: ShareExpiry,
): Promise<ShareState | null> {
  const rows = await db
    .select({ token: projectView.shareToken, expiresAt: projectView.shareExpiresAt })
    .from(projectView)
    .where(eq(projectView.id, viewId));
  if (rows.length === 0) return null;
  const next = nextShare(rows[0], extended, expiresAt);
  await db
    .update(projectView)
    .set({ shareToken: next.token, shareExpiresAt: next.expiresAt, shareExtended: next.choice })
    .where(eq(projectView.id, viewId));
  return next.state;
}

export async function disableViewShare(viewId: number): Promise<boolean> {
  const rows = await db
    .update(projectView)
    .set({ shareToken: null, shareExtended: false, shareExpiresAt: null })
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

// A private view has no public link, whatever token it carries.
const sharedViewByToken = (token: string) =>
  and(
    eq(projectView.shareToken, token),
    eq(projectView.isPrivate, false),
    activeShare(projectView.shareExpiresAt),
  );

// The bundle for a shared view link, or null if no view carries the token.
export async function getSharedView(token: string): Promise<SharedViewBundle | null> {
  const rows = await db.select().from(projectView).where(sharedViewByToken(token));
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
    .where(sharedViewByToken(token));
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
// unknown or expired, so getIssue then returns null.
async function issueIdByToken(token: string): Promise<number> {
  const rows = await db
    .select({ id: issue.id })
    .from(issue)
    .where(and(eq(issue.shareToken, token), activeShare(issue.shareExpiresAt)));
  return rows[0]?.id ?? 0;
}

// --- Documents ------------------------------------------------------------------

// A shared page, and with `includeChildren` its subpages, read without a session. A
// private or archived page is never readable through a link, and neither is anything
// below it.

export interface SharedDocumentPage {
  id: number;
  parentId: number | null;
  title: string;
  icon: string | null;
}

export interface SharedDocumentBundle {
  project: { name: string; key: string };
  document: {
    id: number;
    title: string;
    icon: string | null;
    content: string;
    contentJson: Record<string, unknown> | null;
    fullWidth: boolean;
    updatedAt: string;
  };
  // The pages the link opens, the shared page first with no parent.
  pages: SharedDocumentPage[];
  // The issues of the project this page names, when the link shows them.
  issues: SharedDocumentIssue[];
}

// An issue a shared page names: what its chip shows. It opens through the same link
// (getSharedDocumentIssue).
export interface SharedDocumentIssue {
  id: number;
  sequence: number;
  title: string;
  state: { name: string; color: string };
}

// The project of a document that may be shared, for the enable/revoke guard. A private
// page has no public link, so it is not found here.
export async function shareableDocumentProjectId(documentId: number): Promise<number | null> {
  const rows = await db
    .select({ projectId: projectDocument.projectId })
    .from(projectDocument)
    .where(and(eq(projectDocument.id, documentId), eq(projectDocument.isPrivate, false)));
  return rows[0]?.projectId ?? null;
}

const readablePage = and(eq(projectDocument.isPrivate, false), isNull(projectDocument.archivedAt));

// Enables sharing for a document, the same way enableIssueShare does for an issue.
export async function enableDocumentShare(
  documentId: number,
  includeChildren?: boolean,
  includeIssues?: boolean,
  expiresAt?: ShareExpiry,
): Promise<ShareState | null> {
  const rows = await db
    .select({
      token: projectDocument.shareToken,
      expiresAt: projectDocument.shareExpiresAt,
      archivedAt: projectDocument.archivedAt,
    })
    .from(projectDocument)
    .where(eq(projectDocument.id, documentId));
  if (rows.length === 0) return null;
  if (rows[0].archivedAt) throw new HttpError(409, 'Restore this document before sharing it.');
  const next = nextShare(rows[0], includeChildren, expiresAt);
  // Checked again in the write: a page made private meanwhile must not get a token.
  const written = await db
    .update(projectDocument)
    .set({
      shareToken: next.token,
      shareExpiresAt: next.expiresAt,
      shareIncludeChildren: next.choice,
      shareIncludeIssues: nextChoice(includeIssues, next.live),
    })
    .where(and(eq(projectDocument.id, documentId), readablePage))
    .returning({ id: projectDocument.id });
  if (written.length === 0) return null;
  return next.state;
}

export async function disableDocumentShare(documentId: number): Promise<boolean> {
  const rows = await db
    .update(projectDocument)
    .set(revokedDocumentShare)
    .where(eq(projectDocument.id, documentId))
    .returning({ id: projectDocument.id });
  return rows.length > 0;
}

// The shared page of a token and the pages its link opens, or null when no live link
// carries the token.
async function sharedDocumentPages(
  token: string,
): Promise<{ projectId: number; includeIssues: boolean; pages: SharedDocumentPage[] } | null> {
  const [root] = await db
    .select({
      id: projectDocument.id,
      projectId: projectDocument.projectId,
      title: projectDocument.title,
      icon: projectDocument.icon,
      includeChildren: projectDocument.shareIncludeChildren,
      includeIssues: projectDocument.shareIncludeIssues,
    })
    .from(projectDocument)
    .where(
      and(
        eq(projectDocument.shareToken, token),
        activeShare(projectDocument.shareExpiresAt),
        readablePage,
      ),
    );
  if (!root) return null;
  const pages: SharedDocumentPage[] = [
    { id: root.id, parentId: null, title: root.title, icon: root.icon },
  ];
  const shared = { projectId: root.projectId, includeIssues: root.includeIssues, pages };
  if (!root.includeChildren) return shared;
  const rows = await db
    .select({
      id: projectDocument.id,
      parentId: projectDocument.parentId,
      title: projectDocument.title,
      icon: projectDocument.icon,
    })
    .from(projectDocument)
    .where(and(eq(projectDocument.projectId, root.projectId), readablePage))
    .orderBy(asc(projectDocument.position), asc(projectDocument.id));
  const children = new Map<number, SharedDocumentPage[]>();
  for (const row of rows) {
    if (row.parentId === null) continue;
    const siblings = children.get(row.parentId);
    if (siblings) siblings.push(row);
    else children.set(row.parentId, [row]);
  }
  // Walk down from the shared page. A private or archived page is not among the rows,
  // so its subtree is never reached.
  for (let i = 0; i < pages.length; i++) pages.push(...(children.get(pages[i].id) ?? []));
  return shared;
}

// The bundle for a shared document link: the shared page, or one of the subpages its
// link opens. Null when the token is unknown or the page is not one the link opens.
export async function getSharedDocument(
  token: string,
  documentId?: number,
): Promise<SharedDocumentBundle | null> {
  const shared = await sharedDocumentPages(token);
  if (!shared) return null;
  const id = documentId ?? shared.pages[0].id;
  if (!shared.pages.some((page) => page.id === id)) return null;
  const [[row], project] = await Promise.all([
    db.select().from(projectDocument).where(eq(projectDocument.id, id)),
    getProjectById(shared.projectId),
  ]);
  if (!row || !project) return null;
  // Asset URLs need a session. The page reads them through the token instead, from
  // the web's public /media route.
  const assetUrl = (_match: string, _prefix: string | undefined, publicId: string) =>
    `/media/share/document/${token}/assets/${publicId}/raw`;
  return {
    project: { name: project.name, key: project.key },
    document: {
      id: row.id,
      title: row.title,
      icon: row.icon,
      content: rewriteAssetUrls(row.content, null, assetUrl),
      contentJson: rewriteAssetUrls(row.contentJson, null, assetUrl),
      fullWidth: row.fullWidth,
      updatedAt: iso(row.updatedAt),
    },
    pages: shared.pages,
    issues: shared.includeIssues
      ? await issuesBySequence(project.id, namedSequences(project.key, pageTexts(row)))
      : [],
  };
}

// The most issue identifiers one shared link resolves.
const MAX_NAMED_ISSUES = 500;

// The issue numbers that some text names by identifier (KEY-123).
function namedSequences(key: string, texts: string[]): number[] {
  if (!/^[A-Z0-9]+$/.test(key)) return [];
  const pattern = new RegExp(`(?<![A-Za-z0-9])${key}-([1-9]\\d{0,8})(?![A-Za-z0-9])`, 'g');
  const sequences = new Set<number>();
  for (const text of texts) {
    for (const match of text.matchAll(pattern)) {
      if (sequences.size >= MAX_NAMED_ISSUES) break;
      sequences.add(Number(match[1]));
    }
  }
  return [...sequences];
}

const pageTexts = (page: { content: string; contentJson: unknown }) => [
  page.content,
  JSON.stringify(page.contentJson),
];

// The issues of a project with these numbers, archived ones included.
async function issuesBySequence(
  projectId: number,
  sequences: number[],
): Promise<SharedDocumentIssue[]> {
  if (sequences.length === 0) return [];
  const rows = await db
    .select({
      id: issue.id,
      sequence: issue.sequenceNumber,
      title: issue.title,
      stateName: projectColumn.name,
      stateColor: projectColumn.color,
    })
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(and(eq(issue.projectId, projectId), inArray(issue.sequenceNumber, sequences)))
    .orderBy(asc(issue.sequenceNumber));
  return rows.map((row) => ({
    id: row.id,
    sequence: row.sequence,
    title: row.title,
    state: { name: row.stateName, color: row.stateColor },
  }));
}

// The issue numbers named on any page a link opens.
async function sequencesOfShare(key: string, pageIds: number[]): Promise<number[]> {
  const pages = await db
    .select({ content: projectDocument.content, contentJson: projectDocument.contentJson })
    .from(projectDocument)
    .where(inArray(projectDocument.id, pageIds));
  return namedSequences(key, pages.flatMap(pageTexts));
}

// An issue that a page of a shared document names, read through the document's link
// when the link shows linked issues. It carries what a view shared without full details
// carries: no people, labels, custom fields or activity. Its subtasks and relations
// list only issues the link also names. Null when the link does not name the issue.
export async function getSharedDocumentIssue(
  token: string,
  issueId: number,
): Promise<SharedIssueBundle | null> {
  const shared = await sharedDocumentPages(token);
  if (!shared?.includeIssues) return null;
  const project = await getProjectById(shared.projectId);
  if (!project) return null;
  const sequences = await sequencesOfShare(
    project.key,
    shared.pages.map((page) => page.id),
  );
  const named = await issuesBySequence(project.id, sequences);
  if (!named.some((row) => row.id === issueId)) return null;
  const issueRow = await getIssue(issueId);
  if (!issueRow) return null;
  return issueBundle(issueRow, {
    keepShareToken: false,
    extended: false,
    onlyIssueIds: new Set(named.map((row) => row.id)),
  });
}

// A shared document whose link shows an issue, for the issue's own share dialog.
export interface IssueDocumentShare {
  documentId: number;
  title: string;
  expiresAt: string | null;
}

// The live document links that show this issue: the shared page or one of the subpages
// its link opens names the issue, and the link shows linked issues.
export async function listIssueDocumentShares(issueId: number): Promise<IssueDocumentShare[]> {
  const issueRow = await getIssue(issueId);
  if (!issueRow) return [];
  const project = await getProjectById(issueRow.projectId);
  if (!project) return [];
  const roots = await db
    .select({
      id: projectDocument.id,
      title: projectDocument.title,
      token: projectDocument.shareToken,
      expiresAt: projectDocument.shareExpiresAt,
    })
    .from(projectDocument)
    .where(
      and(
        eq(projectDocument.projectId, project.id),
        isNotNull(projectDocument.shareToken),
        eq(projectDocument.shareIncludeIssues, true),
        activeShare(projectDocument.shareExpiresAt),
        readablePage,
      ),
    )
    .orderBy(asc(projectDocument.title));
  const shares: IssueDocumentShare[] = [];
  for (const root of roots) {
    const shared = await sharedDocumentPages(root.token!);
    if (!shared) continue;
    const sequences = await sequencesOfShare(
      project.key,
      shared.pages.map((page) => page.id),
    );
    if (!sequences.includes(issueRow.sequenceNumber)) continue;
    shares.push({
      documentId: root.id,
      title: root.title,
      expiresAt: root.expiresAt ? iso(root.expiresAt) : null,
    });
  }
  return shares;
}

// An asset of a page the link opens, or null. An asset of any other page is not
// found, even when another page embeds it.
export async function getSharedDocumentAsset(
  token: string,
  publicId: string,
): Promise<{ s3Key: string; contentType: string; filename: string } | null> {
  const shared = await sharedDocumentPages(token);
  if (!shared) return null;
  const rows = await db
    .select({
      s3Key: documentAsset.s3Key,
      contentType: documentAsset.contentType,
      filename: documentAsset.filename,
    })
    .from(documentAsset)
    .where(
      and(
        eq(documentAsset.publicId, publicId),
        inArray(
          documentAsset.documentId,
          shared.pages.map((page) => page.id),
        ),
      ),
    );
  return rows[0] ?? null;
}

// --- Project overview ------------------------------------------------------------

export interface ProjectShares {
  issues: {
    id: number;
    sequence: number;
    title: string;
    extended: boolean;
    expiresAt: string | null;
  }[];
  views: { id: number; name: string; extended: boolean; expiresAt: string | null }[];
  documents: {
    id: number;
    title: string;
    includeChildren: boolean;
    includeIssues: boolean;
    expiresAt: string | null;
  }[];
}

const expiryOf = (expiresAt: Date | null) => (expiresAt ? iso(expiresAt) : null);

// The live public links of a project, for the kinds the reader may see.
export async function listProjectShares(
  projectId: number,
  readable: { issues: boolean; views: boolean; documents: boolean },
): Promise<ProjectShares> {
  const [issues, views, documents] = await Promise.all([
    readable.issues
      ? db
          .select({
            id: issue.id,
            sequence: issue.sequenceNumber,
            title: issue.title,
            extended: issue.shareExtended,
            expiresAt: issue.shareExpiresAt,
          })
          .from(issue)
          .where(
            and(
              eq(issue.projectId, projectId),
              isNotNull(issue.shareToken),
              activeShare(issue.shareExpiresAt),
            ),
          )
          .orderBy(asc(issue.sequenceNumber))
      : [],
    readable.views
      ? db
          .select({
            id: projectView.id,
            name: projectView.name,
            extended: projectView.shareExtended,
            expiresAt: projectView.shareExpiresAt,
          })
          .from(projectView)
          .where(
            and(
              eq(projectView.projectId, projectId),
              isNotNull(projectView.shareToken),
              activeShare(projectView.shareExpiresAt),
            ),
          )
          .orderBy(asc(projectView.name))
      : [],
    readable.documents
      ? db
          .select({
            id: projectDocument.id,
            title: projectDocument.title,
            includeChildren: projectDocument.shareIncludeChildren,
            includeIssues: projectDocument.shareIncludeIssues,
            expiresAt: projectDocument.shareExpiresAt,
          })
          .from(projectDocument)
          .where(
            and(
              eq(projectDocument.projectId, projectId),
              isNotNull(projectDocument.shareToken),
              activeShare(projectDocument.shareExpiresAt),
              readablePage,
            ),
          )
          .orderBy(asc(projectDocument.title))
      : [],
  ]);
  return {
    issues: issues.map((row) => ({ ...row, expiresAt: expiryOf(row.expiresAt) })),
    views: views.map((row) => ({ ...row, expiresAt: expiryOf(row.expiresAt) })),
    documents: documents.map((row) => ({ ...row, expiresAt: expiryOf(row.expiresAt) })),
  };
}

// Revokes every public link of the project of the kinds given. Returns how many it
// revoked.
export async function revokeProjectShares(
  projectId: number,
  kinds: { issues: boolean; views: boolean; documents: boolean },
): Promise<number> {
  const [issues, views, documents] = await Promise.all([
    kinds.issues
      ? db
          .update(issue)
          .set({ shareToken: null, shareExtended: false, shareExpiresAt: null })
          .where(and(eq(issue.projectId, projectId), isNotNull(issue.shareToken)))
          .returning({ id: issue.id })
      : [],
    kinds.views
      ? db
          .update(projectView)
          .set({ shareToken: null, shareExtended: false, shareExpiresAt: null })
          .where(and(eq(projectView.projectId, projectId), isNotNull(projectView.shareToken)))
          .returning({ id: projectView.id })
      : [],
    kinds.documents
      ? db
          .update(projectDocument)
          .set(revokedDocumentShare)
          .where(
            and(eq(projectDocument.projectId, projectId), isNotNull(projectDocument.shareToken)),
          )
          .returning({ id: projectDocument.id })
      : [],
  ]);
  return issues.length + views.length + documents.length;
}
