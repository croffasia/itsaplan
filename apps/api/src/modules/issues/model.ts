import { t } from 'elysia';
import { ActivityPayloadResponse } from '#shared/activity';
import { isoDate } from '#shared/schemas';

// t.Numeric validates a numeric path param and coerces the string to a number. A
// non-numeric id gets a 400 before it reaches the service.
export const issueParams = t.Object({ issueId: t.Numeric() });

// --- Response DTO schemas (mirror the service interfaces the handlers return) -----

// IssueFieldValueEntry from the service: a compact custom field value on an issue. It
// holds the scalar value, the end of a datetime_range, and the selected option ids.
export const IssueFieldValueEntry = t.Object({
  fieldId: t.Number(),
  value: t.Nullable(t.Union([t.String(), t.Number(), t.Boolean()])),
  valueEnd: t.Nullable(t.String()),
  optionIds: t.Array(t.Number()),
});

// IssueRow from the service.
export const IssueResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  sequenceNumber: t.Number(),
  identifier: t.String(),
  typeId: t.Nullable(t.Number()),
  // The linked initiative, or null. It carries id + title for rendering, and status
  // to order the lanes of a board grouped by initiative. Create and update set it
  // through initiativeId.
  initiative: t.Nullable(t.Object({ id: t.Number(), title: t.String(), status: t.String() })),
  // The cycle this issue is planned into, or null. It carries id + name for rendering,
  // and status to filter by the running or the upcoming ones. Create and update set it
  // through cycleId.
  cycle: t.Nullable(t.Object({ id: t.Number(), name: t.String(), status: t.String() })),
  assigneeUserId: t.Nullable(t.String()),
  delegateUserId: t.Nullable(t.String()),
  columnId: t.Number(),
  // The issue this one is a subtask of, or null. Create and update set it.
  parentId: t.Nullable(t.Number()),
  title: t.String(),
  description: t.String(),
  priority: t.Nullable(t.String()),
  // Time is in minutes; the UI enters and shows it as hours and minutes.
  estimatePoints: t.Nullable(t.Number()),
  estimateMinutes: t.Nullable(t.Number()),
  // The sum of the issue's logged time entries, 0 when nothing was logged.
  loggedMinutes: t.Number(),
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

// IssueFieldValueRow from the service: one applicable custom field with its value on
// the issue. fieldType is the CustomFieldType union (a string).
export const IssueFieldValueRow = t.Object({
  fieldId: t.Number(),
  name: t.String(),
  fieldType: t.String(),
  value: t.Nullable(t.Union([t.String(), t.Number(), t.Boolean()])),
  valueEnd: t.Nullable(t.String()),
  optionIds: t.Array(t.Number()),
});

// IssueRef from subtasks.ts: another issue named with the state it is in — an
// issue's parent, one of its subtasks, or the other end of a relation.
export const IssueRefResponse = t.Object({
  id: t.Number(),
  sequenceNumber: t.Number(),
  identifier: t.String(),
  title: t.String(),
  columnId: t.Number(),
  typeId: t.Nullable(t.Number()),
  archived: t.Boolean(),
});

// The kinds a relation is stored under (IssueLinkKind in links.ts).
export const StoredLinkKind = t.Union([
  t.Literal('blocks'),
  t.Literal('relates'),
  t.Literal('duplicates'),
]);

// IssueLinkRow from links.ts: one relation to another issue, as the issue that owns
// the relation reads it.
export const IssueLinkResponse = t.Object({
  id: t.Number(),
  kind: StoredLinkKind,
  direction: t.Union([t.Literal('outward'), t.Literal('inward')]),
  issue: IssueRefResponse,
});

// A relation as one of its two issues reads it (IssueLinkInputKind in links.ts). A
// caller states this kind on create, and a board issue carries it.
export const IssueLinkKindSchema = t.Union(
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
export const BoardIssueLinkResponse = t.Object({
  id: t.Number(),
  relation: IssueLinkKindSchema,
  issueId: t.Number(),
});

// What a delete or an archive does with the issue's subtasks. The request must set it
// when the issue has subtasks. The route ignores it when the issue has none.
export const SubtaskModeSchema = t.Union(
  [t.Literal('cascade'), t.Literal('detach'), t.Literal('reassign')],
  {
    description:
      "What happens to the issue's subtasks: 'cascade' removes them with it, 'detach' turns them into ordinary issues, 'reassign' moves them to newParentId.",
  },
);

export const NewParentIdSchema = t.Integer({
  description: "Numeric id of the issue the subtasks move to. Required by 'reassign'.",
});

// The estimate a create or an update sets. Time arrives as whole minutes: the
// hours-and-minutes field is the UI's, and it sends what it parsed.
export const EstimatePointsSchema = t.Nullable(
  t.Number({ minimum: 0, description: 'Story point estimate, or null to clear it.' }),
);

export const EstimateMinutesSchema = t.Nullable(
  t.Integer({ minimum: 0, description: 'Time estimate in minutes, or null to clear it.' }),
);

// IssueWatcherRow from watchers.ts: one member following the issue.
export const IssueWatcherResponse = t.Object({
  userId: t.String(),
  name: t.String(),
  image: t.Nullable(t.String()),
});

// ChecklistItemRow / ChecklistRow from checklists.ts.
export const ChecklistItemResponse = t.Object({
  id: t.Number(),
  content: t.String(),
  done: t.Boolean(),
  position: t.Number(),
});

export const ChecklistResponse = t.Object({
  id: t.Number(),
  title: t.String(),
  position: t.Number(),
  items: t.Array(ChecklistItemResponse),
});

export const ChecklistTitleSchema = t.String({
  minLength: 1,
  maxLength: 200,
  description: 'Title of the checklist.',
});

export const ChecklistItemContentSchema = t.String({
  minLength: 1,
  maxLength: 500,
  description: 'Text of the checklist item.',
});

// A reorder sends the ids in their new order. The route ignores an id outside the
// parent in the path. An id the caller omits keeps its position after the listed ones.
export const OrderedIdsSchema = t.Object({
  orderedIds: t.Array(t.Integer(), { minItems: 1 }),
});

export const checklistParams = t.Object({ checklistId: t.Numeric() });
export const checklistItemParams = t.Object({ itemId: t.Numeric() });

export const worklogParams = t.Object({ worklogId: t.Numeric() });

// WorklogRow from worklogs.ts: one entry of the time a member spent on the issue,
// with the author it belongs to.
export const WorklogResponse = t.Object({
  id: t.Number(),
  issueId: t.Number(),
  userId: t.String(),
  userName: t.Nullable(t.String()),
  userImage: t.Nullable(t.String()),
  minutes: t.Number(),
  spentOn: t.String(),
  note: t.Nullable(t.String()),
  createdAt: t.String(),
});

export const createWorklogBody = t.Object({
  // Whole minutes: the hours-and-minutes field is the UI's, and it sends what it
  // parsed.
  minutes: t.Integer({ minimum: 1, description: 'Time spent, in minutes.' }),
  spentOn: isoDate("The day the work was done on, 'YYYY-MM-DD'. Not a day in the future."),
  note: t.Optional(
    t.Nullable(t.String({ maxLength: 500, description: 'What the time went into. One line.' })),
  ),
});

export const updateWorklogBody = t.Partial(createWorklogBody);

// GET /issues/:issueId returns the full issue plus its custom field values, its
// relations to other issues, the members watching it, and its checklists.
export const IssueWithFieldsResponse = t.Composite([
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
export const BoardIssueResponse = t.Composite([
  IssueResponse,
  t.Object({
    links: t.Array(BoardIssueLinkResponse),
    // How many subtasks the issue has, archived ones included — the board lists
    // only active issues, so it cannot count them from the payload itself.
    subtaskCount: t.Number(),
  }),
]);

// IssueSearchHit from the service: a light search result. It carries no description
// and no field values.
export const IssueSearchHitResponse = t.Object({
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
export const FeedItemResponse = t.Object({
  id: t.Number(),
  issueId: t.Number(),
  kind: t.String(),
  replyToId: t.Nullable(t.Number()),
  actorUserId: t.Nullable(t.String()),
  actorName: t.Nullable(t.String()),
  body: t.Nullable(t.String()),
  action: t.Nullable(t.String()),
  payload: ActivityPayloadResponse,
  createdAt: t.String(),
});

export const FeedCursorResponse = t.Nullable(t.Object({ ts: t.String(), id: t.Number() }));

// FeedPage from activity.ts: one page of the feed with the keyset cursor.
export const FeedPageResponse = t.Object({
  items: t.Array(FeedItemResponse),
  nextCursor: FeedCursorResponse,
});

// GroupedFeedPage from activity.ts: the same page, split into the stretches the issue
// spent in one column.
export const GroupedFeedPageResponse = t.Object({
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

// Both feed routes page the same way: a limit and the previous page's cursor.
export const feedPageQuery = t.Object({
  limit: t.Optional(t.Numeric({ description: 'Max items per page (1-100). Default 25.' })),
  cursor: t.Optional(t.String({ description: 'nextCursor from the previous page, for paging.' })),
});

// TimelineSegment from status-history.ts: one stretch the issue spent in a column.
export const TimelineSegmentResponse = t.Object({
  status: t.Nullable(t.String()),
  from: t.String(),
  to: t.Nullable(t.String()),
  durationMs: t.Number(),
});

// One cycle an issue was in, with the stretch it spent on it. status follows from
// the cycle's dates, as in CycleResponse.
export const IssueCycleResponse = t.Object({
  cycleId: t.Number(),
  name: t.String(),
  startDate: t.String(),
  endDate: t.String(),
  status: t.String(),
  enteredAt: t.String(),
  leftAt: t.Nullable(t.String()),
});

// --- Request schemas -------------------------------------------------------------

export const projectKeyParams = t.Object({ projectKey: t.String() });

export const createIssueBody = t.Object({
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
  description: t.Optional(t.String({ description: 'Issue description (plain text or markdown).' })),
  priority: t.Optional(
    t.Nullable(t.String({ description: 'One of: urgent, high, medium, low. Or null.' })),
  ),
  estimatePoints: t.Optional(EstimatePointsSchema),
  estimateMinutes: t.Optional(EstimateMinutesSchema),
  startDate: t.Optional(t.Nullable(t.String({ description: "Start date 'YYYY-MM-DD', or null." }))),
  dueDate: t.Optional(t.Nullable(t.String({ description: "Due date 'YYYY-MM-DD', or null." }))),
  labelIds: t.Optional(
    t.Array(t.Integer(), { description: 'Label ids to attach. From get_project.labels.' }),
  ),
});

export const bulkUpdateIssuesBody = t.Object({
  ids: t.Array(t.Integer(), { minItems: 1, description: 'Issue ids to update.' }),
  patch: t.Object({
    columnId: t.Optional(t.Integer()),
    typeId: t.Optional(t.Nullable(t.Integer())),
    initiativeId: t.Optional(t.Nullable(t.Integer())),
    cycleId: t.Optional(t.Nullable(t.Integer())),
    assigneeUserId: t.Optional(t.Nullable(t.String())),
    delegateUserId: t.Optional(t.Nullable(t.String())),
    priority: t.Optional(t.Nullable(t.String())),
    estimatePoints: t.Optional(EstimatePointsSchema),
    estimateMinutes: t.Optional(EstimateMinutesSchema),
    startDate: t.Optional(t.Nullable(t.String())),
    dueDate: t.Optional(t.Nullable(t.String())),
  }),
});

export const bulkAddLabelsBody = t.Object({
  ids: t.Array(t.Integer(), { minItems: 1, description: 'Issue ids to label.' }),
  add: t.Array(t.Integer(), { minItems: 1, description: 'Label ids to add.' }),
});

export const bulkArchiveIssuesBody = t.Object({
  ids: t.Array(t.Integer(), { minItems: 1, description: 'Issue ids to archive.' }),
  subtasks: t.Optional(SubtaskModeSchema),
  newParentId: t.Optional(NewParentIdSchema),
});

export const bulkDeleteIssuesBody = t.Object({
  ids: t.Array(t.Integer(), { minItems: 1, description: 'Issue ids to delete.' }),
  subtasks: t.Optional(SubtaskModeSchema),
  newParentId: t.Optional(NewParentIdSchema),
});

export const searchIssuesQuery = t.Object({
  q: t.Optional(
    t.String({
      description:
        'Case-insensitive substring, matched against the title, description, issue number, and custom field text.',
    }),
  ),
  limit: t.Optional(t.Numeric({ description: 'Max results (1-500). Default 50.' })),
});

export const listIssuesQuery = t.Object({
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
  labelIds: t.Optional(t.String({ description: 'CSV of label ids; the issue must carry all.' })),
  dueFrom: t.Optional(t.String({ description: "Inclusive earliest due date 'YYYY-MM-DD'." })),
  dueTo: t.Optional(t.String({ description: "Inclusive latest due date 'YYYY-MM-DD'." })),
  includeArchived: t.Optional(
    t.String({ description: "'true' to include archived issues. Default false." }),
  ),
  limit: t.Optional(t.Numeric({ description: 'Max results (1-500). Default 50.' })),
});

export const issueSequenceParams = t.Object({
  projectKey: t.String(),
  sequenceNumber: t.Numeric(),
});

export const updateIssueBody = t.Object({
  columnId: t.Optional(t.Integer({ description: 'Move the issue to this column (state) id.' })),
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
    t.Nullable(t.String({ description: 'New assignee user id (a project member), or null.' })),
  ),
  delegateUserId: t.Optional(
    t.Nullable(t.String({ description: 'New delegate user id (an AI agent), or null.' })),
  ),
  title: t.Optional(t.String({ minLength: 1, description: 'New title.' })),
  description: t.Optional(t.String({ description: 'New description.' })),
  priority: t.Optional(
    t.Nullable(t.String({ description: 'One of: urgent, high, medium, low. Or null.' })),
  ),
  estimatePoints: t.Optional(EstimatePointsSchema),
  estimateMinutes: t.Optional(EstimateMinutesSchema),
  startDate: t.Optional(t.Nullable(t.String({ description: "Start date 'YYYY-MM-DD', or null." }))),
  dueDate: t.Optional(t.Nullable(t.String({ description: "Due date 'YYYY-MM-DD', or null." }))),
  labelIds: t.Optional(
    t.Array(t.Integer(), { description: "Replace the issue's labels with these ids." }),
  ),
});

export const subtaskDispositionQuery = t.Object({
  subtasks: t.Optional(SubtaskModeSchema),
  newParentId: t.Optional(t.Numeric(NewParentIdSchema)),
});

export const setIssueFieldValueBody = t.Object({
  value: t.Optional(t.Nullable(t.Union([t.String(), t.Number(), t.Boolean()]))),
  valueEnd: t.Optional(t.Nullable(t.String())),
  optionIds: t.Optional(t.Array(t.Integer())),
});

export const issueFieldParams = t.Object({ issueId: t.Numeric(), fieldId: t.Numeric() });

export const addIssueLinkBody = t.Object({
  targetIssueId: t.Integer({
    description: 'Numeric id of the issue on the other end of the relation.',
  }),
  kind: IssueLinkKindSchema,
});

export const issueLinkParams = t.Object({ issueId: t.Numeric(), linkId: t.Numeric() });

export const checklistTitleBody = t.Object({ title: ChecklistTitleSchema });

export const createChecklistItemBody = t.Object({ content: ChecklistItemContentSchema });

export const updateChecklistItemBody = t.Object({
  content: t.Optional(ChecklistItemContentSchema),
  done: t.Optional(t.Boolean({ description: 'Whether the item is checked off.' })),
});

export const feedRangeQuery = t.Object({
  from: t.String({ description: 'Start of the stretch (ISO datetime), inclusive.' }),
  to: t.Optional(
    t.String({ description: 'End of the stretch (ISO datetime), exclusive. Open-ended.' }),
  ),
});

export const createCommentBody = t.Object({
  body: t.String({ minLength: 1, description: 'Comment text.' }),
  replyToId: t.Optional(t.Number({ description: 'Reply to this comment of the same issue.' })),
});

export const archiveIssueBody = t.Optional(
  t.Object({
    subtasks: t.Optional(SubtaskModeSchema),
    newParentId: t.Optional(NewParentIdSchema),
  }),
);

export const BulkUpdatedResponse = t.Object({ updated: t.Number() });

export const BulkArchivedResponse = t.Object({ archived: t.Number() });

export const BulkDeletedResponse = t.Object({ deleted: t.Number() });

export const BoardResponse = t.Object({ issues: t.Array(BoardIssueResponse) });

export const WatchStateResponse = t.Object({ ok: t.Boolean() });
