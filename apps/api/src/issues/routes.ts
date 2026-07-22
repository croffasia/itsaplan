import { Elysia, t } from 'elysia';
import { mcpTool } from '../mcp/generate';
import { noContent } from '../shared/http';
import { guards, entityGuard } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { assertPermission, assertMcpEnabled, requireUser } from '../shared/access';
import { isMcpRequest } from '../shared/mcp-request';
import { getProjectById } from '../projects/store';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { deleteObject } from '../shared/s3';
import {
  createIssue,
  searchIssues,
  listIssues,
  listArchivedIssues,
  projectBoardRev,
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
  issueRev,
} from './store';
import { listFeed, createComment } from './activity';

// Numeric path params are validated (and coerced string -> number) with t.Numeric,
// so a non-numeric id is rejected with a 400 before reaching the store.
const issueParams = t.Object({ issueId: t.Numeric() });

// --- Response DTO schemas (mirror the store interfaces the handlers return) -------

// IssueFieldValueEntry from the store: a compact custom field value carried on an
// issue (scalar value plus selected option ids).
const IssueFieldValueEntry = t.Object({
  fieldId: t.Number(),
  value: t.Nullable(t.Union([t.String(), t.Number(), t.Boolean()])),
  optionIds: t.Array(t.Number()),
});

// IssueRow from the store.
const IssueResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  sequenceNumber: t.Number(),
  identifier: t.String(),
  typeId: t.Nullable(t.Number()),
  // The linked initiative expanded to id + title (for rendering), or null. Set
  // through create/update by initiativeId.
  initiative: t.Nullable(t.Object({ id: t.Number(), title: t.String() })),
  assigneeUserId: t.Nullable(t.String()),
  delegateUserId: t.Nullable(t.String()),
  columnId: t.Number(),
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
  optionIds: t.Array(t.Number()),
});

// GET /issues/:issueId returns the full issue plus its custom field values.
const IssueWithFieldsResponse = t.Composite([
  IssueResponse,
  t.Object({ fields: t.Array(IssueFieldValueRow) }),
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

// FeedPage from activity.ts: one page of the feed with the keyset cursor.
const FeedPageResponse = t.Object({
  items: t.Array(FeedItemResponse),
  nextCursor: t.Nullable(t.Object({ ts: t.String(), id: t.Number() })),
});

export const issueRoutes = new Elysia({ name: 'issues', detail: { tags: ['Issues'] } })
  .use(authContext)
  .use(guards)
  // Guard for routes that address an issue by its own id (no :projectKey in the
  // path). Set `workItem: "<action>"` in the route options.
  .macro({
    workItem: entityGuard('work_items', 'Issue not found', (p) =>
      getIssueProjectId(Number(p.issueId)),
    ),
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
      response: {
        201: IssueResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
          assigneeUserId: t.Optional(t.Nullable(t.String())),
          delegateUserId: t.Optional(t.Nullable(t.String())),
          priority: t.Optional(t.Nullable(t.String())),
          startDate: t.Optional(t.Nullable(t.String())),
          dueDate: t.Optional(t.Nullable(t.String())),
        }),
      }),
      permission: ['work_items', 'edit'],
      response: {
        200: t.Object({ updated: t.Number() }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      response: {
        200: t.Object({ updated: t.Number() }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Bulk add labels to issues' },
    },
  )

  // Archives every listed issue.
  .post(
    '/projects/:projectKey/issues/bulk/archive',
    async ({ project, body, user }) => {
      const archived = await bulkArchiveIssues(project.id, body.ids, requireUser(user).id);
      return { archived };
    },
    {
      params: t.Object({ projectKey: t.String() }),
      body: t.Object({
        ids: t.Array(t.Integer(), { minItems: 1, description: 'Issue ids to archive.' }),
      }),
      permission: ['work_items', 'edit'],
      response: {
        200: t.Object({ archived: t.Number() }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Bulk archive issues' },
    },
  )

  // Deletes every listed issue and removes their attachment objects.
  .post(
    '/projects/:projectKey/issues/bulk/delete',
    async ({ project, body }) => {
      const { deleted, attachments } = await bulkDeleteIssues(project.id, body.ids);
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
      return { deleted };
    },
    {
      params: t.Object({ projectKey: t.String() }),
      body: t.Object({
        ids: t.Array(t.Integer(), { minItems: 1, description: 'Issue ids to delete.' }),
      }),
      permission: ['work_items', 'delete'],
      response: {
        200: t.Object({ deleted: t.Number() }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      response: {
        200: t.Array(IssueSearchHitResponse),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      response: {
        200: t.Array(IssueSearchHitResponse),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'List issues by filters',
        description: "List a project's issues by field filters.",
        ...mcpTool('list_issues'),
      },
    },
  )

  // The board's issue payload: every active issue with its labels and field
  // values, plus the board change marker. The work-items UI loads this alongside
  // the project scaffold (GET /projects/:projectKey) and polls the marker to
  // refetch. Web-only (not an MCP tool): agents use list_issues / search_issues.
  .get(
    '/projects/:projectKey/issues/board',
    async ({ project }) => ({
      issues: await listIssues(project),
      rev: await projectBoardRev(project.id),
    }),
    {
      params: t.Object({ projectKey: t.String() }),
      permission: ['work_items', 'read'],
      response: {
        200: t.Object({ issues: t.Array(IssueResponse), rev: t.String() }),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Get board issues' },
    },
  )

  // Cheap change marker for the board's issues. Clients poll this and refetch the
  // board issues only when it moves (live refresh without constant heavy reads).
  .get(
    '/projects/:projectKey/issues/rev',
    async ({ project }) => ({
      rev: await projectBoardRev(project.id),
    }),
    {
      params: t.Object({ projectKey: t.String() }),
      permission: ['work_items', 'read'],
      response: {
        200: t.Object({ rev: t.String() }),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Get board revision' },
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
      response: {
        200: t.Array(IssueResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      return { ...issue, fields };
    },
    {
      params: t.Object({ projectKey: t.String(), sequenceNumber: t.Numeric() }),
      permission: ['work_items', 'read'],
      response: {
        200: IssueWithFieldsResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      return { ...issue, fields };
    },
    {
      params: issueParams,
      response: {
        200: IssueWithFieldsResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
    async ({ params, body, user }) => {
      const actorUserId = requireUser(user).id;
      const issueId = params.issueId;
      const { labelIds, ...patch } = body;
      const issue = await updateIssue(issueId, patch, actorUserId);
      if (!issue) throw new HttpError(404, 'Issue not found');
      if (labelIds) {
        await setIssueLabels(issueId, labelIds, actorUserId);
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
        initiativeId: t.Optional(
          t.Nullable(
            t.Integer({
              description:
                'Link this issue to an initiative id, or null to unlink. From list_initiatives.',
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
      response: {
        200: IssueResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
    async ({ params }) => {
      const attachments = await deleteIssue(params.issueId);
      if (!attachments) throw new HttpError(404, 'Issue not found');
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
      return noContent();
    },
    {
      params: issueParams,
      workItem: 'delete',
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Delete an issue',
        description: 'Permanently delete an issue by its numeric id. Irreversible.',
        ...mcpTool('delete_issue'),
      },
    },
  )

  // Archives an issue: hides it from the board and lists but keeps it, so it can
  // be restored. The same effect the worker's auto-archive sweep applies, done on
  // demand. Uses the work_items edit permission.
  .post(
    '/issues/:issueId/archive',
    async ({ params, user }) => {
      const issue = await archiveIssue(params.issueId, requireUser(user).id);
      if (!issue) throw new HttpError(404, 'Issue not found');
      return issue;
    },
    {
      params: issueParams,
      workItem: 'edit',
      response: {
        200: IssueResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Archive an issue',
        description: 'Archive an issue by its numeric id.',
        ...mcpTool('archive_issue'),
      },
    },
  )

  // Restores an archived issue back onto the board (clears archived_at).
  .post(
    '/issues/:issueId/restore',
    async ({ params, user }) => {
      const issue = await restoreIssue(params.issueId, requireUser(user).id);
      if (!issue) throw new HttpError(404, 'Issue not found');
      return issue;
    },
    {
      params: issueParams,
      workItem: 'edit',
      response: {
        200: IssueResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Restore an archived issue',
        description: 'Restore an archived issue by its numeric id.',
        ...mcpTool('restore_issue'),
      },
    },
  )

  // Sets one custom field's value on one issue. For select/multi_select fields,
  // body.optionIds replaces the full selection; for every other field type,
  // body.value must match the field's type (text/number/boolean/date).
  .put(
    '/issues/:issueId/fields/:fieldId',
    async ({ params, body, user }) => {
      await setIssueFieldValue(params.issueId, params.fieldId, body, requireUser(user).id);
      return { ok: true };
    },
    {
      body: t.Object({
        value: t.Optional(t.Nullable(t.Union([t.String(), t.Number(), t.Boolean()]))),
        optionIds: t.Optional(t.Array(t.Integer())),
      }),
      params: t.Object({ issueId: t.Numeric(), fieldId: t.Numeric() }),
      workItem: 'edit',
      response: {
        200: t.Object({ ok: t.Boolean() }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Set a custom field value',
        description: 'Set a custom field value on an issue by its numeric id.',
        ...mcpTool('set_issue_field_value'),
      },
    },
  )

  // One page of an issue's timeline, newest first: comments and change-log
  // activity merged in issue_activity. `limit` (default 25) and an opaque
  // `cursor` (the JSON-encoded nextCursor from the previous page) drive keyset
  // pagination; the response is { items, nextCursor }, nextCursor null at the end.
  .get(
    '/issues/:issueId/feed',
    async ({ params, query }) => {
      const issueId = params.issueId;
      const limit = query.limit ?? 25;
      let before = null;
      if (query.cursor) {
        try {
          before = JSON.parse(query.cursor);
        } catch {
          // Ignore a malformed cursor and serve the first page.
        }
      }
      return listFeed(issueId, { before, limit });
    },
    {
      params: issueParams,
      query: t.Object({
        limit: t.Optional(t.Numeric({ description: 'Max items per page (1-100). Default 25.' })),
        cursor: t.Optional(
          t.String({ description: 'nextCursor from the previous page, for paging.' }),
        ),
      }),
      workItem: 'read',
      response: {
        200: FeedPageResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Get an issue feed',
        description: "Get an issue's activity feed by its numeric id.",
        ...mcpTool('list_issue_activity'),
      },
    },
  )

  // Cheap change marker for the issue's detail + feed. Clients poll this and
  // refetch the full issue/feed only when it changes (live refresh without
  // constant heavy reads). Same read permission as the feed.
  .get('/issues/:issueId/rev', async ({ params }) => ({ rev: await issueRev(params.issueId) }), {
    params: issueParams,
    workItem: 'read',
    response: {
      200: t.Object({ rev: t.String() }),
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
    detail: { summary: 'Get issue revision' },
  })

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
      response: {
        201: FeedItemResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Add a comment',
        description: 'Add a comment to an issue by its numeric id.',
        ...mcpTool('add_comment'),
      },
    },
  );
