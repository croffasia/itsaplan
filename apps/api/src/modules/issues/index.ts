import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { noContent } from '#shared/http';
import { guards, entityGuard, assertMcpAllowed } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { assertPermission, assertProjectOwner, requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { deleteObject } from '#shared/s3';
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
} from './service';
import {
  listFeed,
  listFeedRange,
  listGroupedFeed,
  createComment,
  type FeedCursor,
} from './activity';
import { listStatusTimeline } from './status-history';
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
  createWorklog,
  deleteWorklog,
  getWorklogRef,
  listWorklogs,
  updateWorklog,
} from './worklogs';
import { listIssueCycles } from './cycle-history';
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

import {
  issueParams,
  IssueResponse,
  IssueLinkResponse,
  IssueWatcherResponse,
  ChecklistItemResponse,
  ChecklistResponse,
  OrderedIdsSchema,
  checklistParams,
  checklistItemParams,
  worklogParams,
  WorklogResponse,
  createWorklogBody,
  updateWorklogBody,
  IssueWithFieldsResponse,
  IssueSearchHitResponse,
  FeedItemResponse,
  FeedPageResponse,
  GroupedFeedPageResponse,
  feedPageQuery,
  TimelineSegmentResponse,
  IssueCycleResponse,
  projectKeyParams,
  createIssueBody,
  bulkUpdateIssuesBody,
  bulkAddLabelsBody,
  bulkArchiveIssuesBody,
  bulkDeleteIssuesBody,
  searchIssuesQuery,
  listIssuesQuery,
  issueSequenceParams,
  updateIssueBody,
  subtaskDispositionQuery,
  setIssueFieldValueBody,
  issueFieldParams,
  addIssueLinkBody,
  issueLinkParams,
  checklistTitleBody,
  createChecklistItemBody,
  updateChecklistItemBody,
  feedRangeQuery,
  createCommentBody,
  archiveIssueBody,
  BulkUpdatedResponse,
  BulkArchivedResponse,
  BulkDeletedResponse,
  BoardResponse,
  WatchStateResponse,
} from './model';

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

// The cursor travels as JSON in the query string. A malformed one gives null, which
// serves the first page.
function feedCursor(raw?: string): FeedCursor | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FeedCursor;
  } catch {
    return null;
  }
}

export const issueRoutes = new Elysia({ name: 'issues', detail: { tags: ['Issues'] } })
  .use(authContext)
  .use(guards)
  // Guards for routes that address an entity by its own id (no :projectKey in the
  // path). Set `workItem` / `checklist` / `checklistItem` to the action in the
  // route options, `worklog` to true. A checklist, its items and a time entry
  // belong to the issue that carries them, so they all resolve to the same
  // work_items permission.
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
    // A time entry belongs to the member who logged it: they change and delete
    // their own with the work_items edit this asserts. Someone else's is a record
    // of what that member did, so only a project owner may touch it — no
    // permission on the matrix grants it. Hence not an ordinary entityGuard: the
    // rule depends on the row, not on the route.
    worklog(_enabled: boolean) {
      return {
        async resolve({ params, user, request }) {
          const entry = await getWorklogRef(Number((params as { worklogId: string }).worklogId));
          if (!entry) throw new HttpError(404, 'Time entry not found');
          await assertPermission(entry.projectId, user, 'work_items', 'edit');
          if (entry.userId !== requireUser(user).id)
            await assertProjectOwner(entry.projectId, user);
          await assertMcpAllowed(entry.projectId, request.headers);
          return { projectId: entry.projectId };
        },
      };
    },
  })
  .post(
    '/projects/:projectKey/issues',
    async ({ project, body, user, set }) => {
      set.status = 201;
      return createIssue(project, body, requireUser(user).id);
    },
    {
      body: createIssueBody,
      permission: ['work_items', 'create'],
      response: { 201: IssueResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Create an issue',
        description:
          'Create an issue in a project. Fails with 409 (code wip_limit_exceeded) ' +
          'when the target column is at a hard WIP limit.',
        ...mcpTool('create_issue'),
      },
    },
  )

  // --- Bulk actions (board multi-select) -----------------------------------------
  // Project-scoped, so the `permission` guard resolves the project and asserts access
  // once. The service filters the ids to this project, so a bulk action can never
  // touch another project's issues.

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
      params: projectKeyParams,
      body: bulkUpdateIssuesBody,
      permission: ['work_items', 'edit'],
      response: { 200: BulkUpdatedResponse, ...commonErrors, ...errors(409) },
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
      params: projectKeyParams,
      body: bulkAddLabelsBody,
      permission: ['work_items', 'edit'],
      response: { 200: BulkUpdatedResponse, ...commonErrors },
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
      params: projectKeyParams,
      body: bulkArchiveIssuesBody,
      permission: ['work_items', 'edit'],
      response: { 200: BulkArchivedResponse, ...commonErrors, ...errors(409) },
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
      params: projectKeyParams,
      body: bulkDeleteIssuesBody,
      permission: ['work_items', 'delete'],
      response: { 200: BulkDeletedResponse, ...commonErrors, ...errors(409) },
      detail: { summary: 'Bulk delete issues' },
    },
  )

  // Text search: matches q (case-insensitive substring) against the title,
  // description, issue number, and custom field text. Always searches every issue,
  // archived included, and each hit carries an 'archived' flag. Filtering by fields is
  // a separate concern (see list_issues). This route comes before
  // /issues/:sequenceNumber so the static "search" segment wins over the numeric param.
  .get(
    '/projects/:projectKey/issues/search',
    async ({ project, query }) => {
      const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
      return searchIssues(project, { query: query.q, limit }, { includeArchived: true });
    },
    {
      params: projectKeyParams,
      query: searchIssuesQuery,
      permission: ['work_items', 'read'],
      response: { 200: t.Array(IssueSearchHitResponse), ...commonErrors },
      detail: {
        summary: 'Search issues by text',
        description: "Search a project's issues by text.",
        ...mcpTool('search_issues'),
      },
    },
  )

  // Filtered list: no text query, only exact field filters. Every filter is optional,
  // and every filter the caller sets must match. With no filters this lists the
  // project's active issues. It leaves out archived issues unless includeArchived is
  // 'true'.
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
      params: projectKeyParams,
      query: listIssuesQuery,
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
      params: projectKeyParams,
      permission: ['work_items', 'read'],
      response: { 200: BoardResponse, ...accessErrors },
      detail: { summary: 'Get board issues' },
    },
  )

  // The project's archived issues, newest archived first, for the archive view
  // and restore. Same read permission as the board.
  .get(
    '/projects/:projectKey/issues/archived',
    async ({ project }) => listArchivedIssues(project),
    {
      params: projectKeyParams,
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
      params: issueSequenceParams,
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

  // Reads the full issue including its custom field values. The handler fetches the
  // issue for the response, so it asserts access on that row instead of using the
  // workItem guard, which would resolve the project id a second time.
  .get(
    '/issues/:issueId',
    async ({ params, user, request }) => {
      const issue = await getIssue(params.issueId);
      if (!issue) throw new HttpError(404, 'Issue not found');
      await assertPermission(issue.projectId, user, 'work_items', 'read');
      // This route resolves the project itself, so it also enforces the per-project
      // MCP toggle itself (it does not run through the workItem guard).
      await assertMcpAllowed(issue.projectId, request.headers);
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
      body: updateIssueBody,
      params: issueParams,
      workItem: 'edit',
      response: { 200: IssueResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Update an issue',
        description:
          'Update an issue by its numeric id. Moving it into a column that is at a ' +
          'hard WIP limit fails with 409 (code wip_limit_exceeded).',
        ...mcpTool('update_issue'),
      },
    },
  )

  // Deletes an issue, together with its custom field values, labels, attachments,
  // comments and activity. It then deletes the attachment objects from the object
  // store. A failed object delete only orphans bytes, so it does not fail the
  // request.
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
      query: subtaskDispositionQuery,
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
      body: archiveIssueBody,
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

  // Sets one custom field's value on one issue. For a select or multi_select field,
  // body.optionIds replaces the full selection. For every other field type, body.value
  // must match the field's type (text/number/boolean/date/datetime, and the user id of
  // a project member for a member field). A datetime_range takes its end in
  // body.valueEnd.
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
      body: setIssueFieldValueBody,
      params: issueFieldParams,
      workItem: 'edit',
      response: { 200: WatchStateResponse, ...commonErrors },
      detail: {
        summary: 'Set a custom field value',
        description:
          'Set a custom field value on an issue by its numeric id. A member field takes the ' +
          "user id of a project member the field's scope allows.",
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
      body: addIssueLinkBody,
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
      params: issueLinkParams,
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
      body: checklistTitleBody,
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
      body: checklistTitleBody,
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
      body: createChecklistItemBody,
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
  // frequent write here, so it deliberately does not reach the activity feed.
  .patch(
    '/checklists/items/:itemId',
    async ({ params, body }) => updateChecklistItem(params.itemId, body),
    {
      body: updateChecklistItemBody,
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

  // The time logged on the issue. The entries are their own read: the issue payload
  // carries their sum, which is what a board and the Time property show, and only
  // the section that lists them needs the entries themselves.
  .get('/issues/:issueId/worklogs', async ({ params }) => listWorklogs(params.issueId), {
    params: issueParams,
    workItem: 'read',
    response: { 200: t.Array(WorklogResponse), ...commonErrors },
    detail: {
      summary: "List an issue's logged time",
      description:
        'Every time entry on an issue, the newest day first. The time an issue took is the sum of them.',
      ...mcpTool('list_worklogs'),
    },
  })

  .post(
    '/issues/:issueId/worklogs',
    async ({ params, body, user, set }) => {
      set.status = 201;
      return createWorklog(params.issueId, requireUser(user).id, body);
    },
    {
      body: createWorklogBody,
      params: issueParams,
      workItem: 'edit',
      response: { 201: WorklogResponse, ...commonErrors },
      detail: {
        summary: 'Log time on an issue',
        description:
          'Log the time spent on an issue. The entry belongs to whoever logs it, and the day it was spent on cannot be in the future.',
        ...mcpTool('create_worklog'),
      },
    },
  )

  .patch(
    '/worklogs/:worklogId',
    async ({ params, body, user }) => updateWorklog(params.worklogId, body, requireUser(user).id),
    {
      body: updateWorklogBody,
      params: worklogParams,
      worklog: true,
      response: { 200: WorklogResponse, ...commonErrors },
      detail: {
        summary: 'Change a time entry',
        description:
          "Change the time, the day or the note of an entry. Another member's entry needs work_items delete.",
        ...mcpTool('update_worklog'),
      },
    },
  )

  .delete(
    '/worklogs/:worklogId',
    async ({ params, user }) => {
      const removed = await deleteWorklog(params.worklogId, requireUser(user).id);
      if (!removed) throw new HttpError(404, 'Time entry not found');
      return noContent();
    },
    {
      params: worklogParams,
      worklog: true,
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete a time entry',
        description:
          "Remove one entry, lowering the issue's logged time by it. Another member's entry needs work_items delete.",
        ...mcpTool('delete_worklog'),
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

  // Stops following the issue. The route records the unsubscription instead of
  // forgetting it, so a later comment on the issue does not silently re-subscribe
  // the caller.
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
  // pagination. The response is { items, nextCursor }, and nextCursor is null on the
  // last page.
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
        description:
          "Get an issue's activity feed by its numeric id: comments and change-log " +
          'entries, newest first. The page holds the top-level entries; the replies of ' +
          "its comments come with them, each carrying its parent's id in replyToId.",
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
  // and a client reads the entries of one stretch separately when it opens that
  // stretch.
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
      query: feedRangeQuery,
      workItem: 'read',
      response: { 200: t.Array(FeedItemResponse), ...commonErrors },
      detail: {
        summary: 'Get the activity of one timeline stretch',
        description: "Get an issue's activity entries written between two moments, oldest first.",
      },
    },
  )

  // Read on its own, not as part of the issue: only the issue screen shows the
  // cycles, and every board carries the issue payload.
  .get('/issues/:issueId/cycles', async ({ params }) => listIssueCycles(params.issueId), {
    params: issueParams,
    workItem: 'read',
    response: { 200: t.Array(IssueCycleResponse), ...commonErrors },
    detail: {
      summary: 'Get an issue cycle history',
      description:
        'Get the cycles an issue was in, oldest first: the ones it was still planned into when they ended, plus its current one.',
    },
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
        replyToId: body.replyToId,
      });
    },
    {
      body: createCommentBody,
      params: issueParams,
      workItem: 'create',
      response: { 201: FeedItemResponse, ...commonErrors },
      detail: {
        summary: 'Add a comment',
        description:
          'Add a comment to an issue by its numeric id. Pass replyToId to answer an ' +
          'existing comment of that issue instead of starting a new thread. Writing ' +
          '@username in the body notifies that member or AI agent; the handles are ' +
          'the usernames in get_project.assignees.',
        ...mcpTool('add_comment'),
      },
    },
  );
