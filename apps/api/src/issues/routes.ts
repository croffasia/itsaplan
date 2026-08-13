import { Elysia, t } from 'elysia';
import { mcpTool } from '../mcp/generate';
import { noContent } from '../shared/http';
import { guards, entityGuard } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { assertPermission, assertMcpEnabled, requireUser } from '../shared/access';
import { isMcpRequest } from '../shared/mcp-request';
import { getProjectById } from '../projects/store';
import { HttpError } from '../shared/lib';
import { accessErrors, commonErrors, errors } from '../shared/responses';
import { deleteObject } from '../shared/s3';
import {
  createIssue,
  searchIssues,
  listIssues,
  listArchivedIssues,
  getIssue,
  getIssueBySequence,
  getIssueProjectId,
  updateIssue,
  deleteIssue,
  archiveIssue,
  restoreIssue,
  bulkUpdateIssues,
  bulkAddLabels,
  bulkArchiveIssues,
  bulkDeleteIssues,
  setIssueLabels,
  setIssueFieldValue,
  getIssueFieldValues,
} from './store';
import {
  listFeed,
  listFeedRange,
  listGroupedFeed,
  listStatusTimeline,
  createComment,
  type FeedCursor,
} from './activity';
import { addIssueLink, attachBoardLinks, listIssueLinks, removeIssueLink } from './links';
import {
  attachSubtaskCounts,
  disposeSubtasksOf,
  getParentRef,
  listSubtasks,
  restoreSubtasksOf,
  type SubtaskDisposition,
  type SubtaskMode,
} from './subtasks';
import { listIssueWatchers, setIssueWatching } from './watchers';
import {
  createChecklist,
  createChecklistItem,
  deleteChecklist,
  deleteChecklistItem,
  getChecklistIssueId,
  getChecklistItemIssueId,
  listChecklists,
  renameChecklist,
  reorderChecklistItems,
  reorderChecklists,
  updateChecklistItem,
} from './checklists';

// Numeric path params are validated (and coerced string -> number) with t.Numeric,
// so a non-numeric id is rejected with a 400 before reaching the store.
const issueParams = t.Object({ issueId: t.Numeric() });

// The subtask choice a delete or archive request carries, or undefined when it
// carries none.
function disposition(
  input?: { subtasks?: SubtaskMode; newParentId?: number } | null,
): SubtaskDisposition | undefined {
  if (!input?.subtasks) return undefined;
  return { mode: input.subtasks, newParentId: input.newParentId };
}

// Removes the deleted issues' attachment objects. A failed object delete only
// orphans bytes, so it does not fail the request.
async function purgeObjects(attachments: { s3Key: string }[]): Promise<void> {
  await Promise.all(
    attachments.map((a) =>
      deleteObject(a.s3Key).catch((err) => {
        console.error(
          `[planner] failed to delete object ${a.s3Key}:`,
          err instanceof Error ? err.message : err,
        );
      }),
    ),
  );
}

// --- Response DTO schemas (mirror the store interfaces the handlers return) -------

// IssueFieldValueEntry from the store: a compact custom field value carried on an
// issue (scalar value, the end of a datetime_range, and selected option ids).
const IssueFieldValueEntry = t.Object({
  fieldId: t.Number(),
  value: t.Nullable(t.Union([t.String(), t.Number(), t.Boolean()])),
  valueEnd: t.Nullable(t.String()),
  optionIds: t.Array(t.Number()),
});

// IssueRow from the store.
const IssueResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  sequenceNumber: t.Number(),
  identifier: t.String(),
  typeId: t.Nullable(t.Number()),
  // The linked initiative expanded to id + title for rendering and status for
  // ordering the lanes of a board grouped by initiative, or null. Set through
  // create/update by initiativeId.
  initiative: t.Nullable(t.Object({ id: t.Number(), title: t.String(), status: t.String() })),
  // The cycle this issue is planned into, expanded to id + name for rendering and
  // status for filtering by the running or the upcoming ones, or null. Set through
  // create/update by cycleId.
  cycle: t.Nullable(t.Object({ id: t.Number(), name: t.String(), status: t.String() })),
  assigneeUserId: t.Nullable(t.String()),
  delegateUserId: t.Nullable(t.String()),
  columnId: t.Number(),
  // The issue this one is a subtask of, or null. Set through create/update.
  parentId: t.Nullable(t.Number()),
  title: t.String(),
  description: t.String(),
  priority: t.Nullable(t.String()),
  startDate: t.Nullable(t.String()),
  dueDate: t.Nullable(t.String()),
  position: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String(),
  archivedAt: t.Nullable(t.String()),
  statusSince: t.String(),
  shareToken: t.Nullable(t.String()),
  shareExtended: t.Boolean(),
  labelIds: t.Array(t.Number()),
  fieldValues: t.Array(IssueFieldValueEntry),
});

// IssueFieldValueRow from the store: one applicable custom field joined with its
// value on the issue. fieldType is the CustomFieldType union (a string).
const IssueFieldValueRow = t.Object({
  fieldId: t.Number(),
  name: t.String(),
  fieldType: t.String(),
  value: t.Nullable(t.Union([t.String(), t.Number(), t.Boolean()])),
  valueEnd: t.Nullable(t.String()),
  optionIds: t.Array(t.Number()),
});

// IssueRef from subtasks.ts: another issue named with the state it is in — an
// issue's parent, one of its subtasks, or the other end of a relation.
const IssueRefResponse = t.Object({
  id: t.Number(),
  sequenceNumber: t.Number(),
  identifier: t.String(),
  title: t.String(),
  columnId: t.Number(),
  typeId: t.Nullable(t.Number()),
  archived: t.Boolean(),
});

// The kinds a relation is stored under (IssueLinkKind in links.ts).
const StoredLinkKind = t.Union([
  t.Literal('blocks'),
  t.Literal('relates'),
  t.Literal('duplicates'),
]);

// IssueLinkRow from links.ts: one relation to another issue, as it reads from the
// issue it was loaded for.
const IssueLinkResponse = t.Object({
  id: t.Number(),
  kind: StoredLinkKind,
  direction: t.Union([t.Literal('outward'), t.Literal('inward')]),
  issue: IssueRefResponse,
});

// A relation as one of its two issues reads it (IssueLinkInputKind in links.ts):
// what a caller states when creating one, and what a board issue carries.
const IssueLinkKindSchema = t.Union(
  [
    t.Literal('blocks'),
    t.Literal('blocked_by'),
    t.Literal('relates'),
    t.Literal('duplicates'),
    t.Literal('duplicated_by'),
  ],
  {
    description:
      'How one issue relates to the other: blocks, blocked_by, relates, duplicates, or duplicated_by.',
  },
);

// BoardIssueLink from links.ts: one relation on the issue carrying it, with the
// other end as an id.
const BoardIssueLinkResponse = t.Object({
  id: t.Number(),
  relation: IssueLinkKindSchema,
  issueId: t.Number(),
});

// What a delete or an archive does with the issue's subtasks. Required when it has
// any, ignored when it has none.
const SubtaskModeSchema = t.Union(
  [t.Literal('cascade'), t.Literal('detach'), t.Literal('reassign')],
  {
    description:
      "What happens to the issue's subtasks: 'cascade' removes them with it, 'detach' turns them into ordinary issues, 'reassign' moves them to newParentId.",
  },
);

const NewParentIdSchema = t.Integer({
  description: "Numeric id of the issue the subtasks move to. Required by 'reassign'.",
});

// IssueWatcherRow from watchers.ts: one member following the issue.
const IssueWatcherResponse = t.Object({
  userId: t.String(),
  name: t.String(),
  image: t.Nullable(t.String()),
});

// ChecklistItemRow / ChecklistRow from checklists.ts.
const ChecklistItemResponse = t.Object({
  id: t.Number(),
  content: t.String(),
  done: t.Boolean(),
  position: t.Number(),
});

const ChecklistResponse = t.Object({
  id: t.Number(),
  title: t.String(),
  position: t.Number(),
  items: t.Array(ChecklistItemResponse),
});

const ChecklistTitleSchema = t.String({
  minLength: 1,
  maxLength: 200,
  description: 'Title of the checklist.',
});

const ChecklistItemContentSchema = t.String({
  minLength: 1,
  maxLength: 500,
  description: 'Text of the checklist item.',
});

// A reorder sends the ids in their new order. Ids outside the parent in the path
// are ignored, and ones left out keep their position after the listed ones.
const OrderedIdsSchema = t.Object({
  orderedIds: t.Array(t.Integer(), { minItems: 1 }),
});

const checklistParams = t.Object({ checklistId: t.Numeric() });
const checklistItemParams = t.Object({ itemId: t.Numeric() });

// GET /issues/:issueId returns the full issue plus its custom field values, its
// relations to other issues, the members watching it, and its checklists.
const IssueWithFieldsResponse = t.Composite([
  IssueResponse,
  t.Object({
    fields: t.Array(IssueFieldValueRow),
    links: t.Array(IssueLinkResponse),
    watchers: t.Array(IssueWatcherResponse),
    parent: t.Nullable(IssueRefResponse),
    subtasks: t.Array(IssueRefResponse),
    checklists: t.Array(ChecklistResponse),
  }),
]);

// The board carries each issue's relations on the issue itself.
const BoardIssueResponse = t.Composite([
  IssueResponse,
  t.Object({
    links: t.Array(BoardIssueLinkResponse),
    // How many subtasks the issue has, archived ones included — the board lists
    // only active issues, so it cannot count them from the payload itself.
    subtaskCount: t.Number(),
  }),
]);

// IssueSearchHit from the store: a light search result (no description/field values).
const IssueSearchHitResponse = t.Object({
  id: t.Number(),
  sequenceNumber: t.Number(),
  identifier: t.String(),
  title: t.String(),
  columnId: t.Number(),
  typeId: t.Nullable(t.Number()),
  initiativeId: t.Nullable(t.Number()),
  cycleId: t.Nullable(t.Number()),
  parentId: t.Nullable(t.Number()),
  assigneeUserId: t.Nullable(t.String()),
  delegateUserId: t.Nullable(t.String()),
  priority: t.Nullable(t.String()),
  dueDate: t.Nullable(t.String()),
  labelIds: t.Array(t.Number()),
  archived: t.Boolean(),
});

// FeedItemRow from activity.ts: one timeline entry (comment or change-log).
// kind is the FeedKind union (a string).
const FeedItemResponse = t.Object({
  id: t.Number(),
  issueId: t.Number(),
  kind: t.String(),
  actorUserId: t.Nullable(t.String()),
  actorName: t.Nullable(t.String()),
  body: t.Nullable(t.String()),
  action: t.Nullable(t.String()),
  subject: t.Nullable(t.String()),
  fromText: t.Nullable(t.String()),
  toText: t.Nullable(t.String()),
  createdAt: t.String(),
});

const FeedCursorResponse = t.Nullable(t.Object({ ts: t.String(), id: t.Number() }));

// FeedPage from activity.ts: one page of the feed with the keyset cursor.
const FeedPageResponse = t.Object({
  items: t.Array(FeedItemResponse),
  nextCursor: FeedCursorResponse,
});

// GroupedFeedPage from activity.ts: the same page, split into the stretches the issue
// spent in one column.
const GroupedFeedPageResponse = t.Object({
  groups: t.Array(
    t.Object({
      status: t.Nullable(t.String()),
      from: t.String(),
      to: t.Nullable(t.String()),
      durationMs: t.Number(),
      repeat: t.Boolean(),
      items: t.Array(FeedItemResponse),
    }),
  ),
  nextCursor: FeedCursorResponse,
});

// Both feed routes are paged the same way: a limit and the previous page's cursor.
const feedPageQuery = t.Object({
  limit: t.Optional(t.Numeric({ description: 'Max items per page (1-100). Default 25.' })),
  cursor: t.Optional(t.String({ description: 'nextCursor from the previous page, for paging.' })),
});

// The cursor travels as JSON in the query string. A malformed one is ignored, which
// serves the first page.
function feedCursor(raw?: string): FeedCursor | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FeedCursor;
  } catch {
    return null;
  }
}

// TimelineSegment from activity.ts: one stretch the issue spent in a column.
const TimelineSegmentResponse = t.Object({
  status: t.Nullable(t.String()),
  from: t.String(),
  to: t.Nullable(t.String()),
  durationMs: t.Number(),
});

export const issueRoutes = new Elysia({ name: 'issues', detail: { tags: ['Issues'] } })
  .use(authContext)
  .use(guards)
  // Guards for routes that address an entity by its own id (no :projectKey in the
  // path). Set `workItem` / `checklist` / `checklistItem` to the action in the
  // route options. A checklist and its items are part of the issue they hang on,
  // so all three resolve to the same work_items permission.
  .macro({
    workItem: entityGuard('work_items', 'Issue not found', (p) =>
      getIssueProjectId(Number(p.issueId)),
    ),
    checklist: entityGuard('work_items', 'Checklist not found', async (p) => {
      const issueId = await getChecklistIssueId(Number(p.checklistId));
      return issueId == null ? null : getIssueProjectId(issueId);
    }),
    checklistItem: entityGuard('work_items', 'Checklist item not found', async (p) => {
      const issueId = await getChecklistItemIssueId(Number(p.itemId));
      return issueId == null ? null : getIssueProjectId(issueId);
    }),
  })
  .post(
    '/projects/:projectKey/issues',
    async ({ project, body, user, set }) => {
      set.status = 201;
      return createIssue(project, body, requireUser(user).id);
    },
    {
      body: t.Object({
        typeId: t.Optional(
          t.Nullable(t.Integer({ description: 'Issue type id, or null. From get_project.' })),
        ),
        initiativeId: t.Optional(
          t.Nullable(
            t.Integer({
              description: 'Initiative id to link this issue to, or null. From list_initiatives.',
            }),
          ),
        ),
        cycleId: t.Optional(
          t.Nullable(
            t.Integer({
              description:
                'Cycle id to plan this issue into, or null. From list_cycles; a completed cycle is rejected.',
            }),
          ),
        ),
        assigneeUserId: t.Optional(
          t.Nullable(
            t.String({
              description:
                "Assignee user id (a project member), or null. From get_project.assignees where kind is 'member'.",
            }),
          ),
        ),
        delegateUserId: t.Optional(
          t.Nullable(
            t.String({
              description:
                "Delegate user id (an AI agent), or null. From get_project.assignees where kind is 'agent'.",
            }),
          ),
        ),
        columnId: t.Integer({ description: 'Target column (state) id. From get_project.columns.' }),
        parentId: t.Optional(
          t.Nullable(
            t.Integer({
              description:
                'Numeric id of the issue this one is a subtask of, or null. The parent must be in this project and must not be a subtask itself.',
            }),
          ),
        ),
        title: t.String({ minLength: 1, description: 'Issue title.' }),
        description: t.Optional(
          t.String({ description: 'Issue description (plain text or markdown).' }),
        ),
        priority: t.Optional(
          t.Nullable(t.String({ description: 'One of: urgent, high, medium, low. Or null.' })),
        ),
        startDate: t.Optional(
          t.Nullable(t.String({ description: "Start date 'YYYY-MM-DD', or null." })),
        ),
        dueDate: t.Optional(
          t.Nullable(t.String({ description: "Due date 'YYYY-MM-DD', or null." })),
        ),
        labelIds: t.Optional(
          t.Array(t.Integer(), { description: 'Label ids to attach. From get_project.labels.' }),
        ),
      }),
      permission: ['work_items', 'create'],
      response: { 201: IssueResponse, ...commonErrors },
      detail: {
        summary: 'Create an issue',
        description: 'Create an issue in a project.',
        ...mcpTool('create_issue'),
      },
    },
  )

  // --- Bulk actions (board multi-select) -----------------------------------------
  // Project-scoped so the `permission` guard resolves the project and asserts
  // access once; the store filters the ids to this project, so a bulk action can
  // never touch another project's issues.

  // Applies one patch to every listed issue.
  .patch(
    '/projects/:projectKey/issues/bulk',
    async ({ project, body, user }) => {
      const updated = await bulkUpdateIssues(
        project.id,
        body.ids,
        body.patch,
        requireUser(user).id,
      );
      return { updated };
    },
    {
      params: t.Object({ projectKey: t.String() }),
      body: t.Object({
        ids: t.Array(t.Integer(), { minItems: 1, description: 'Issue ids to update.' }),
        patch: t.Object({
          columnId: t.Optional(t.Integer()),
          typeId: t.Optional(t.Nullable(t.Integer())),
          initiativeId: t.Optional(t.Nullable(t.Integer())),
          cycleId: t.Optional(t.Nullable(t.Integer())),
          assigneeUserId: t.Optional(t.Nullable(t.String())),
          delegateUserId: t.Optional(t.Nullable(t.String())),
          priority: t.Optional(t.Nullable(t.String())),
          startDate: t.Optional(t.Nullable(t.String())),
          dueDate: t.Optional(t.Nullable(t.String())),
        }),
      }),
      permission: ['work_items', 'edit'],
      response: { 200: t.Object({ updated: t.Number() }), ...commonErrors },
      detail: { summary: 'Bulk update issues' },
    },
  )

  // Adds labels to every listed issue, keeping their existing labels.
  .post(
    '/projects/:projectKey/issues/bulk/labels',
    async ({ project, body, user }) => {
      const updated = await bulkAddLabels(project.id, body.ids, body.add, requireUser(user).id);
      return { updated };
    },
    {
      params: t.Object({ projectKey: t.String() }),
      body: t.Object({
        ids: t.Array(t.Integer(), { minItems: 1, description: 'Issue ids to label.' }),
        add: t.Array(t.Integer(), { minItems: 1, description: 'Label ids to add.' }),
      }),
      permission: ['work_items', 'edit'],
      response: { 200: t.Object({ updated: t.Number() }), ...commonErrors },
      detail: { summary: 'Bulk add labels to issues' },
    },
  )

  // Archives every listed issue.
  .post(
    '/projects/:projectKey/issues/bulk/archive',
    async ({ project, body, user }) => {
      const actorUserId = requireUser(user).id;
      await disposeSubtasksOf(project.id, body.ids, 'archive', disposition(body), actorUserId);
      const archived = await bulkArchiveIssues(project.id, body.ids, actorUserId);
      return { archived };
    },
    {
      params: t.Object({ projectKey: t.String() }),
      body: t.Object({
        ids: t.Array(t.Integer(), { minItems: 1, description: 'Issue ids to archive.' }),
        subtasks: t.Optional(SubtaskModeSchema),
        newParentId: t.Optional(NewParentIdSchema),
      }),
      permission: ['work_items', 'edit'],
      response: { 200: t.Object({ archived: t.Number() }), ...commonErrors, ...errors(409) },
      detail: { summary: 'Bulk archive issues' },
    },
  )

  // Deletes every listed issue and removes their attachment objects.
  .post(
    '/projects/:projectKey/issues/bulk/delete',
    async ({ project, body, user }) => {
      const fromSubtasks = await disposeSubtasksOf(
        project.id,
        body.ids,
        'delete',
        disposition(body),
        requireUser(user).id,
      );
      const { deleted, attachments } = await bulkDeleteIssues(project.id, body.ids);
      await purgeObjects([...fromSubtasks, ...attachments]);
      return { deleted };
    },
    {
      params: t.Object({ projectKey: t.String() }),
      body: t.Object({
        ids: t.Array(t.Integer(), { minItems: 1, description: 'Issue ids to delete.' }),
        subtasks: t.Optional(SubtaskModeSchema),
        newParentId: t.Optional(NewParentIdSchema),
      }),
      permission: ['work_items', 'delete'],
      response: { 200: t.Object({ deleted: t.Number() }), ...commonErrors, ...errors(409) },
      detail: { summary: 'Bulk delete issues' },
    },
  )

  // Text search: matches q (case-insensitive substring) against the title,
  // description, issue number, and custom field text. Always searches every issue,
  // archived included (each hit carries an 'archived' flag); filtering by fields is
  // a separate concern (see list_issues). Declared before /issues/:sequenceNumber so
  // the static "search" segment wins over the numeric param.
  .get(
    '/projects/:projectKey/issues/search',
    async ({ project, query }) => {
      const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
      return searchIssues(project, { query: query.q, limit }, { includeArchived: true });
    },
    {
      params: t.Object({ projectKey: t.String() }),
      query: t.Object({
        q: t.Optional(
          t.String({
            description:
              'Case-insensitive substring, matched against the title, description, issue number, and custom field text.',
          }),
        ),
        limit: t.Optional(t.Numeric({ description: 'Max results (1-500). Default 50.' })),
      }),
      permission: ['work_items', 'read'],
      response: { 200: t.Array(IssueSearchHitResponse), ...commonErrors },
      detail: {
        summary: 'Search issues by text',
        description: "Search a project's issues by text.",
        ...mcpTool('search_issues'),
      },
    },
  )

  // Filtered list: no text query, only exact field filters. Every filter is optional
  // and all supplied ones must match; with no filters this lists the project's active
  // issues. Archived are excluded unless includeArchived is 'true'.
  .get(
    '/projects/:projectKey/issues',
    async ({ project, query }) => {
      const labelIds = query.labelIds
        ? query.labelIds.split(',').map(Number).filter(Number.isFinite)
        : undefined;
      // A filter is "not set" when its value is empty. An LLM calling this as a tool
      // tends to fill every optional field with a placeholder (0 for a numeric id,
      // "" for a string) rather than omitting it; those must mean "any", not a filter
      // on id 0 / the empty string. Serial ids are always positive, so a non-positive
      // id is never a real filter. This keeps the list robust to any model.
      const posId = (v: number | undefined) => (v && v > 0 ? v : undefined);
      const str = (v: string | undefined) => (v ? v : undefined);
      const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
      return searchIssues(
        project,
        {
          columnId: posId(query.columnId),
          typeId: posId(query.typeId),
          initiativeId: posId(query.initiativeId),
          cycleId: posId(query.cycleId),
          parentId: posId(query.parentId),
          assigneeUserId: str(query.assigneeUserId),
          delegateUserId: str(query.delegateUserId),
          priority: str(query.priority),
          labelIds: labelIds && labelIds.length ? labelIds : undefined,
          dueFrom: str(query.dueFrom),
          dueTo: str(query.dueTo),
          limit,
        },
        { includeArchived: query.includeArchived === 'true' },
      );
    },
    {
      params: t.Object({ projectKey: t.String() }),
      query: t.Object({
        columnId: t.Optional(t.Numeric({ description: 'Exact column (state) id.' })),
        typeId: t.Optional(t.Numeric({ description: 'Exact issue type id.' })),
        initiativeId: t.Optional(t.Numeric({ description: 'Exact initiative id.' })),
        cycleId: t.Optional(t.Numeric({ description: 'Exact cycle id.' })),
        parentId: t.Optional(
          t.Numeric({ description: 'Parent issue id, to list that issue’s subtasks.' }),
        ),
        assigneeUserId: t.Optional(t.String({ description: 'Exact assignee user id.' })),
        delegateUserId: t.Optional(t.String({ description: 'Exact delegate agent id.' })),
        priority: t.Optional(t.String({ description: 'Exact priority value.' })),
        labelIds: t.Optional(
          t.String({ description: 'CSV of label ids; the issue must carry all.' }),
        ),
        dueFrom: t.Optional(t.String({ description: "Inclusive earliest due date 'YYYY-MM-DD'." })),
        dueTo: t.Optional(t.String({ description: "Inclusive latest due date 'YYYY-MM-DD'." })),
        includeArchived: t.Optional(
          t.String({ description: "'true' to include archived issues. Default false." }),
        ),
        limit: t.Optional(t.Numeric({ description: 'Max results (1-500). Default 50.' })),
      }),
      permission: ['work_items', 'read'],
      response: { 200: t.Array(IssueSearchHitResponse), ...commonErrors },
      detail: {
        summary: 'List issues by filters',
        description: "List a project's issues by field filters.",
        ...mcpTool('list_issues'),
      },
    },
  )

  // The board's issue payload: every active issue with its labels, field values
  // and relations. The work-items UI loads this alongside the project scaffold
  // (GET /projects/:projectKey) and refetches it when the board scope of
  // GET /sync/rev moves. Web-only (not an MCP tool): agents use list_issues /
  // search_issues, and read an issue's relations with the issue itself.
  .get(
    '/projects/:projectKey/issues/board',
    async ({ project }) => ({
      issues: await attachSubtaskCounts(
        await attachBoardLinks(await listIssues(project), project.id),
        project.id,
      ),
    }),
    {
      params: t.Object({ projectKey: t.String() }),
      permission: ['work_items', 'read'],
      response: { 200: t.Object({ issues: t.Array(BoardIssueResponse) }), ...accessErrors },
      detail: { summary: 'Get board issues' },
    },
  )

  // The project's archived issues, newest archived first, for the archive view
  // and restore. Same read permission as the board.
  .get(
    '/projects/:projectKey/issues/archived',
    async ({ project }) => listArchivedIssues(project),
    {
      params: t.Object({ projectKey: t.String() }),
      permission: ['work_items', 'read'],
      response: { 200: t.Array(IssueResponse), ...accessErrors },
      detail: { summary: 'List archived issues' },
    },
  )

  // Reads an issue by its project-scoped sequence number (the human number in a
  // URL like /project/MKT/issue/42), with its custom field values. Backs the
  // identifier-based issue page. Same read permission as the by-id read.
  .get(
    '/projects/:projectKey/issues/:sequenceNumber',
    async ({ project, params }) => {
      const issue = await getIssueBySequence(project.id, params.sequenceNumber);
      if (!issue) throw new HttpError(404, 'Issue not found');
      const fields = await getIssueFieldValues(issue.id);
      const links = await listIssueLinks(issue.id);
      const watchers = await listIssueWatchers(project.id, issue.id);
      const parent = await getParentRef(issue.parentId);
      const subtasks = await listSubtasks(issue.id);
      const checklists = await listChecklists(issue.id);
      return { ...issue, fields, links, watchers, parent, subtasks, checklists };
    },
    {
      params: t.Object({ projectKey: t.String(), sequenceNumber: t.Numeric() }),
      permission: ['work_items', 'read'],
      response: { 200: IssueWithFieldsResponse, ...commonErrors },
      detail: {
        summary: 'Get an issue by number',
        description:
          'Get an issue by its project-scoped number: the 42 in "MKT-42". Use this when you were given an identifier; get_issue takes the internal numeric id instead.',
        ...mcpTool('get_issue_by_number'),
      },
    },
  )

  // Reads the full issue including its custom field values. The issue is fetched
  // for the response, so access is asserted on the fetched row rather than
  // through the workItem guard (which would re-resolve the project id).
  .get(
    '/issues/:issueId',
    async ({ params, user, request }) => {
      const issue = await getIssue(params.issueId);
      if (!issue) throw new HttpError(404, 'Issue not found');
      await assertPermission(issue.projectId, user, 'work_items', 'read');
      // This route resolves the project itself, so it also enforces the per-project
      // MCP toggle itself (it does not run through the workItem guard).
      if (isMcpRequest(request.headers)) {
        const project = await getProjectById(issue.projectId);
        if (project) assertMcpEnabled(project, true);
      }
      const fields = await getIssueFieldValues(issue.id);
      const links = await listIssueLinks(issue.id);
      const watchers = await listIssueWatchers(issue.projectId, issue.id);
      const parent = await getParentRef(issue.parentId);
      const subtasks = await listSubtasks(issue.id);
      const checklists = await listChecklists(issue.id);
      return { ...issue, fields, links, watchers, parent, subtasks, checklists };
    },
    {
      params: issueParams,
      response: { 200: IssueWithFieldsResponse, ...commonErrors },
      detail: {
        summary: 'Get an issue',
        description: 'Get an issue by its numeric id.',
        ...mcpTool('get_issue'),
      },
    },
  )

  // Also handles moving an issue between columns (columnId) and reordering within
  // a column (position).
  .patch(
    '/issues/:issueId',
    async ({ params, body, user, projectId }) => {
      const actorUserId = requireUser(user).id;
      const issueId = params.issueId;
      const { labelIds, ...patch } = body;
      const issue = await updateIssue(issueId, patch, actorUserId);
      if (!issue) throw new HttpError(404, 'Issue not found');
      if (labelIds) {
        await setIssueLabels(projectId, issueId, labelIds, actorUserId);
        issue.labelIds = labelIds;
      }
      return issue;
    },
    {
      body: t.Object({
        columnId: t.Optional(
          t.Integer({ description: 'Move the issue to this column (state) id.' }),
        ),
        position: t.Optional(t.Number({ description: 'Ordering position within the column.' })),
        typeId: t.Optional(t.Nullable(t.Integer({ description: 'New issue type id, or null.' }))),
        parentId: t.Optional(
          t.Nullable(
            t.Integer({
              description:
                'Make this issue a subtask of that issue id, or null to detach it. The parent must be in this project and must not be a subtask itself; an issue that has subtasks cannot become one.',
            }),
          ),
        ),
        initiativeId: t.Optional(
          t.Nullable(
            t.Integer({
              description:
                'Link this issue to an initiative id, or null to unlink. From list_initiatives.',
            }),
          ),
        ),
        cycleId: t.Optional(
          t.Nullable(
            t.Integer({
              description:
                'Plan this issue into a cycle id, or null to unplan it. From list_cycles; a completed cycle is rejected.',
            }),
          ),
        ),
        assigneeUserId: t.Optional(
          t.Nullable(
            t.String({ description: 'New assignee user id (a project member), or null.' }),
          ),
        ),
        delegateUserId: t.Optional(
          t.Nullable(t.String({ description: 'New delegate user id (an AI agent), or null.' })),
        ),
        title: t.Optional(t.String({ minLength: 1, description: 'New title.' })),
        description: t.Optional(t.String({ description: 'New description.' })),
        priority: t.Optional(
          t.Nullable(t.String({ description: 'One of: urgent, high, medium, low. Or null.' })),
        ),
        startDate: t.Optional(
          t.Nullable(t.String({ description: "Start date 'YYYY-MM-DD', or null." })),
        ),
        dueDate: t.Optional(
          t.Nullable(t.String({ description: "Due date 'YYYY-MM-DD', or null." })),
        ),
        labelIds: t.Optional(
          t.Array(t.Integer(), { description: "Replace the issue's labels with these ids." }),
        ),
      }),
      params: issueParams,
      workItem: 'edit',
      response: { 200: IssueResponse, ...commonErrors },
      detail: {
        summary: 'Update an issue',
        description: 'Update an issue by its numeric id.',
        ...mcpTool('update_issue'),
      },
    },
  )

  // Deletes an issue. Its custom field values, labels, attachments, comments and
  // activity are removed with it. Attachment objects are then deleted from the
  // object store; a failed object delete only orphans bytes, so it does not fail
  // the request.
  .delete(
    '/issues/:issueId',
    async ({ params, query, user, projectId }) => {
      const fromSubtasks = await disposeSubtasksOf(
        projectId,
        [params.issueId],
        'delete',
        disposition(query),
        requireUser(user).id,
      );
      const attachments = await deleteIssue(params.issueId);
      if (!attachments) throw new HttpError(404, 'Issue not found');
      await purgeObjects([...fromSubtasks, ...attachments]);
      return noContent();
    },
    {
      params: issueParams,
      query: t.Object({
        subtasks: t.Optional(SubtaskModeSchema),
        newParentId: t.Optional(t.Numeric(NewParentIdSchema)),
      }),
      workItem: 'delete',
      response: { 204: t.Void(), ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Delete an issue',
        description:
          "Permanently delete an issue by its numeric id. Irreversible. An issue that has subtasks needs the subtasks parameter, which says whether they are deleted with it ('cascade'), detached into ordinary issues ('detach'), or moved to newParentId ('reassign').",
        ...mcpTool('delete_issue'),
      },
    },
  )

  // Archives an issue: hides it from the board and lists but keeps it, so it can
  // be restored. The same effect the worker's auto-archive sweep applies, done on
  // demand. Uses the work_items edit permission.
  .post(
    '/issues/:issueId/archive',
    async ({ params, body, user, projectId }) => {
      const actorUserId = requireUser(user).id;
      await disposeSubtasksOf(
        projectId,
        [params.issueId],
        'archive',
        disposition(body),
        actorUserId,
      );
      const issue = await archiveIssue(params.issueId, actorUserId);
      if (!issue) throw new HttpError(404, 'Issue not found');
      return issue;
    },
    {
      params: issueParams,
      body: t.Optional(
        t.Object({
          subtasks: t.Optional(SubtaskModeSchema),
          newParentId: t.Optional(NewParentIdSchema),
        }),
      ),
      workItem: 'edit',
      response: { 200: IssueResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Archive an issue',
        description:
          "Archive an issue by its numeric id. An issue that has subtasks needs the subtasks field, which says whether they are archived with it ('cascade'), detached into ordinary issues ('detach'), or moved to newParentId ('reassign').",
        ...mcpTool('archive_issue'),
      },
    },
  )

  // Restores an archived issue back onto the board (clears archived_at), together
  // with its archived subtasks.
  .post(
    '/issues/:issueId/restore',
    async ({ params, user }) => {
      const actorUserId = requireUser(user).id;
      const issue = await restoreIssue(params.issueId, actorUserId);
      if (!issue) throw new HttpError(404, 'Issue not found');
      await restoreSubtasksOf(issue.id, actorUserId);
      return issue;
    },
    {
      params: issueParams,
      workItem: 'edit',
      response: { 200: IssueResponse, ...commonErrors },
      detail: {
        summary: 'Restore an archived issue',
        description:
          'Restore an archived issue by its numeric id. Its archived subtasks are restored with it.',
        ...mcpTool('restore_issue'),
      },
    },
  )

  // Sets one custom field's value on one issue. For select/multi_select fields,
  // body.optionIds replaces the full selection; for every other field type,
  // body.value must match the field's type (text/number/boolean/date/datetime).
  // A datetime_range takes its end in body.valueEnd.
  .put(
    '/issues/:issueId/fields/:fieldId',
    async ({ params, body, user, projectId }) => {
      await setIssueFieldValue(
        projectId,
        params.issueId,
        params.fieldId,
        body,
        requireUser(user).id,
      );
      return { ok: true };
    },
    {
      body: t.Object({
        value: t.Optional(t.Nullable(t.Union([t.String(), t.Number(), t.Boolean()]))),
        valueEnd: t.Optional(t.Nullable(t.String())),
        optionIds: t.Optional(t.Array(t.Integer())),
      }),
      params: t.Object({ issueId: t.Numeric(), fieldId: t.Numeric() }),
      workItem: 'edit',
      response: { 200: t.Object({ ok: t.Boolean() }), ...commonErrors },
      detail: {
        summary: 'Set a custom field value',
        description: 'Set a custom field value on an issue by its numeric id.',
        ...mcpTool('set_issue_field_value'),
      },
    },
  )

  // Links the issue in the path to another issue of the same project. The
  // relation reads from the issue in the path (it blocks / relates to /
  // duplicates the target); both issues show it, each from its own side. Reading
  // the relations is part of the issue read, so there is no list route.
  .post(
    '/issues/:issueId/links',
    async ({ params, body, user, set }) => {
      set.status = 201;
      return addIssueLink(params.issueId, body.targetIssueId, body.kind, requireUser(user).id);
    },
    {
      body: t.Object({
        targetIssueId: t.Integer({
          description: 'Numeric id of the issue on the other end of the relation.',
        }),
        kind: IssueLinkKindSchema,
      }),
      params: issueParams,
      workItem: 'edit',
      response: { 201: IssueLinkResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Link two issues',
        description:
          'Link an issue to another issue of the same project. kind states the relation as read from the issue in the path: it blocks, is blocked by, relates to, duplicates, or is duplicated by the target. Both issue ids are the internal numeric ids.',
        ...mcpTool('link_issues'),
      },
    },
  )

  // Removes one relation. The link id comes from the issue's own links, so a link
  // between two other issues cannot be removed through it.
  .delete(
    '/issues/:issueId/links/:linkId',
    async ({ params, user }) => {
      const removed = await removeIssueLink(params.issueId, params.linkId, requireUser(user).id);
      if (!removed) throw new HttpError(404, 'Link not found');
      return noContent();
    },
    {
      params: t.Object({ issueId: t.Numeric(), linkId: t.Numeric() }),
      workItem: 'edit',
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Unlink two issues',
        description: "Remove one of an issue's relations by the link id.",
        ...mcpTool('unlink_issues'),
      },
    },
  )

  // Checklists on the issue: lists of small steps that do not warrant a subtask.
  // The issue read already carries them, so this list route is for a refresh
  // after a checklist write rather than the first render.
  .get('/issues/:issueId/checklists', async ({ params }) => listChecklists(params.issueId), {
    params: issueParams,
    workItem: 'read',
    response: { 200: t.Array(ChecklistResponse), ...commonErrors },
    detail: {
      summary: "List an issue's checklists",
      description: 'Every checklist of an issue with its items, both in display order.',
    },
  })

  .post(
    '/issues/:issueId/checklists',
    async ({ params, body, user, set }) => {
      set.status = 201;
      return createChecklist(params.issueId, body.title, requireUser(user).id);
    },
    {
      body: t.Object({ title: ChecklistTitleSchema }),
      params: issueParams,
      workItem: 'edit',
      response: { 201: ChecklistResponse, ...commonErrors },
      detail: {
        summary: 'Add a checklist',
        description: 'Add a checklist to an issue. It starts empty; add its items separately.',
      },
    },
  )

  // Registered before /checklists/:checklistId so the literal segment wins over
  // the parameter.
  .put(
    '/issues/:issueId/checklists/reorder',
    async ({ params, body }) => reorderChecklists(params.issueId, body.orderedIds),
    {
      body: OrderedIdsSchema,
      params: issueParams,
      workItem: 'edit',
      response: { 200: t.Array(ChecklistResponse), ...commonErrors },
      detail: {
        summary: "Reorder an issue's checklists",
        description: "Set the display order of an issue's checklists.",
      },
    },
  )

  .patch(
    '/checklists/:checklistId',
    async ({ params, body, user }) =>
      renameChecklist(params.checklistId, body.title, requireUser(user).id),
    {
      body: t.Object({ title: ChecklistTitleSchema }),
      params: checklistParams,
      checklist: 'edit',
      response: { 200: ChecklistResponse, ...commonErrors },
      detail: { summary: 'Rename a checklist', description: "Change a checklist's title." },
    },
  )

  // Deleting a checklist deletes its items with it.
  .delete(
    '/checklists/:checklistId',
    async ({ params, user }) => {
      const removed = await deleteChecklist(params.checklistId, requireUser(user).id);
      if (!removed) throw new HttpError(404, 'Checklist not found');
      return noContent();
    },
    {
      params: checklistParams,
      checklist: 'edit',
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete a checklist',
        description: 'Delete a checklist and every item on it.',
      },
    },
  )

  .post(
    '/checklists/:checklistId/items',
    async ({ params, body, user, set }) => {
      set.status = 201;
      return createChecklistItem(params.checklistId, body.content, requireUser(user).id);
    },
    {
      body: t.Object({ content: ChecklistItemContentSchema }),
      params: checklistParams,
      checklist: 'edit',
      response: { 201: ChecklistItemResponse, ...commonErrors },
      detail: {
        summary: 'Add a checklist item',
        description: 'Append an item to a checklist.',
      },
    },
  )

  .put(
    '/checklists/:checklistId/items/reorder',
    async ({ params, body }) => reorderChecklistItems(params.checklistId, body.orderedIds),
    {
      body: OrderedIdsSchema,
      params: checklistParams,
      checklist: 'edit',
      response: { 200: t.Array(ChecklistItemResponse), ...commonErrors },
      detail: {
        summary: 'Reorder checklist items',
        description: 'Set the display order of the items within one checklist.',
      },
    },
  )

  // Edits the text, the checked state, or both. Checking a box is the most
  // frequent write here, so it is deliberately not written to the activity feed.
  .patch(
    '/checklists/items/:itemId',
    async ({ params, body }) => updateChecklistItem(params.itemId, body),
    {
      body: t.Object({
        content: t.Optional(ChecklistItemContentSchema),
        done: t.Optional(t.Boolean({ description: 'Whether the item is checked off.' })),
      }),
      params: checklistItemParams,
      checklistItem: 'edit',
      response: { 200: ChecklistItemResponse, ...commonErrors },
      detail: {
        summary: 'Update a checklist item',
        description: "Change a checklist item's text, its checked state, or both.",
      },
    },
  )

  .delete(
    '/checklists/items/:itemId',
    async ({ params, user }) => {
      const removed = await deleteChecklistItem(params.itemId, requireUser(user).id);
      if (!removed) throw new HttpError(404, 'Checklist item not found');
      return noContent();
    },
    {
      params: checklistItemParams,
      checklistItem: 'edit',
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete a checklist item',
        description: 'Remove one item from a checklist.',
      },
    },
  )

  // Follows the issue: the caller receives every notification it produces until
  // they unwatch it. Only ever the caller — one member does not subscribe
  // another. Reading the issue is enough, since watching adds no other access.
  // Both routes return the resulting list, which the issue read also carries.
  .post(
    '/issues/:issueId/watch',
    async ({ params, projectId, user }) => {
      await setIssueWatching(params.issueId, requireUser(user).id, true);
      return listIssueWatchers(projectId, params.issueId);
    },
    {
      params: issueParams,
      workItem: 'read',
      response: { 200: t.Array(IssueWatcherResponse), ...commonErrors },
      detail: {
        summary: 'Watch an issue',
        description: 'Subscribe the current user to an issue and return its watchers.',
      },
    },
  )

  // Stops following the issue. The unsubscription is recorded rather than
  // forgotten, so commenting on the issue again does not silently re-subscribe.
  .delete(
    '/issues/:issueId/watch',
    async ({ params, projectId, user }) => {
      await setIssueWatching(params.issueId, requireUser(user).id, false);
      return listIssueWatchers(projectId, params.issueId);
    },
    {
      params: issueParams,
      workItem: 'read',
      response: { 200: t.Array(IssueWatcherResponse), ...commonErrors },
      detail: {
        summary: 'Unwatch an issue',
        description: 'Unsubscribe the current user from an issue and return its watchers.',
      },
    },
  )

  // One page of an issue's timeline, newest first: comments and change-log
  // activity merged in issue_activity. `limit` (default 25) and an opaque
  // `cursor` (the JSON-encoded nextCursor from the previous page) drive keyset
  // pagination; the response is { items, nextCursor }, nextCursor null at the end.
  .get(
    '/issues/:issueId/feed',
    async ({ params, query }) =>
      listFeed(params.issueId, { before: feedCursor(query.cursor), limit: query.limit }),
    {
      params: issueParams,
      query: feedPageQuery,
      workItem: 'read',
      response: { 200: FeedPageResponse, ...commonErrors },
      detail: {
        summary: 'Get an issue feed',
        description: "Get an issue's activity feed by its numeric id.",
        ...mcpTool('list_issue_activity'),
      },
    },
  )

  // The same page, split into the stretches the issue spent in one column: the
  // grouped shape of the activity log reads this instead of grouping client-side.
  .get(
    '/issues/:issueId/feed/grouped',
    async ({ params, query }) =>
      listGroupedFeed(params.issueId, { before: feedCursor(query.cursor), limit: query.limit }),
    {
      params: issueParams,
      query: feedPageQuery,
      workItem: 'read',
      response: { 200: GroupedFeedPageResponse, ...commonErrors },
      detail: {
        summary: 'Get an issue feed grouped by status',
        description:
          "Get a page of an issue's activity feed, split into the stretches it spent in one status.",
      },
    },
  )

  // The stretches the issue spent in one column, oldest first, with the duration of
  // each. Entry-free and unpaged: the change log holds a handful of status entries,
  // and what happened inside a stretch is read separately when it is opened.
  .get('/issues/:issueId/timeline', async ({ params }) => listStatusTimeline(params.issueId), {
    params: issueParams,
    workItem: 'read',
    response: { 200: t.Array(TimelineSegmentResponse), ...commonErrors },
    detail: {
      summary: 'Get an issue status timeline',
      description: "Get the stretches an issue spent in each status, with each one's duration.",
    },
  })

  // The entries of one stretch of that timeline, addressed by its bounds: the
  // client opening a bar asks for [from, to), leaving `to` off for the open one.
  .get(
    '/issues/:issueId/timeline/items',
    async ({ params, query }) => listFeedRange(params.issueId, query.from, query.to),
    {
      params: issueParams,
      query: t.Object({
        from: t.String({ description: 'Start of the stretch (ISO datetime), inclusive.' }),
        to: t.Optional(
          t.String({ description: 'End of the stretch (ISO datetime), exclusive. Open-ended.' }),
        ),
      }),
      workItem: 'read',
      response: { 200: t.Array(FeedItemResponse), ...commonErrors },
      detail: {
        summary: 'Get the activity of one timeline stretch',
        description: "Get an issue's activity entries written between two moments, oldest first.",
      },
    },
  )

  // Post a comment on an issue. The author is the session user (a member or an
  // agent's bot user).
  .post(
    '/issues/:issueId/comments',
    async ({ params, body, user, set }) => {
      set.status = 201;
      return createComment({
        issueId: params.issueId,
        actorUserId: requireUser(user).id,
        body: body.body,
      });
    },
    {
      body: t.Object({ body: t.String({ minLength: 1, description: 'Comment text.' }) }),
      params: issueParams,
      workItem: 'create',
      response: { 201: FeedItemResponse, ...commonErrors },
      detail: {
        summary: 'Add a comment',
        description: 'Add a comment to an issue by its numeric id.',
        ...mcpTool('add_comment'),
      },
    },
  );
