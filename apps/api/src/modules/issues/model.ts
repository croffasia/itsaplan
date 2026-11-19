import { t } from 'elysia';
import { MAX_SUBTASK_DEPTH } from '@repo/db';
import { agentExecutionState } from '#modules/agents/model';
import { ActivityPayloadResponse } from '#shared/activity';
import { DevelopmentLinkResponse } from '#modules/git/model';
import { AgentTraceDetailResponse } from '#modules/agents/core/model';
import { instantQuery, isoDate } from '#shared/schemas';

// Ceiling of every markdown text written on an issue: the description, a comment
// and a custom field value. Each of them is scanned for mentions.
export const ISSUE_TEXT_LIMIT = 50_000;

// t.Numeric validates a numeric path param and coerces the string to a number. A
// non-numeric id gets a 400 before it reaches the service.
export const issueParams = t.Object({ issueId: t.Numeric() });
export const issueDevelopmentLinkParams = t.Object({
  issueId: t.Numeric(),
  linkId: t.Numeric(),
});
export const issueDevelopmentRepositoryParams = t.Object({
  issueId: t.Numeric(),
  repositoryId: t.Numeric(),
});

export const issueDevelopmentListQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1 })),
  state: t.Optional(t.Union([t.Literal('open'), t.Literal('all')])),
});

export const linkIssueDevelopmentBody = t.Object({
  repositoryId: t.Integer({ minimum: 1 }),
  number: t.Integer({ minimum: 1 }),
});

export const createIssuePullRequestBody = t.Object({
  repositoryId: t.Integer({ minimum: 1 }),
  sourceBranch: t.String({ minLength: 1, maxLength: 500 }),
  targetBranch: t.String({ minLength: 1, maxLength: 500 }),
  title: t.String({ minLength: 1, maxLength: 500 }),
  description: t.String({ maxLength: 50_000 }),
  draft: t.Boolean(),
});

export const DevelopmentRepositoryResponse = t.Object({
  id: t.Number(),
  provider: t.Union([
    t.Literal('github'),
    t.Literal('gitlab'),
    t.Literal('gitea'),
    t.Literal('forgejo'),
  ]),
  fullName: t.String(),
  webUrl: t.String(),
});

export const LinkablePullRequestResponse = t.Object({
  number: t.Number(),
  title: t.String(),
  url: t.Nullable(t.String()),
  state: t.Union([t.Literal('open'), t.Literal('merged'), t.Literal('closed')]),
  draft: t.Boolean(),
  sourceBranch: t.Nullable(t.String()),
  targetBranch: t.String(),
  headSha: t.Nullable(t.String()),
  updatedAt: t.String(),
  linked: t.Boolean(),
});

export const LinkablePullRequestPageResponse = t.Object({
  pullRequests: t.Array(LinkablePullRequestResponse),
  nextPage: t.Nullable(t.Number()),
});

export const DevelopmentBranchPageResponse = t.Object({
  branches: t.Array(t.String()),
  defaultBranch: t.Nullable(t.String()),
  nextPage: t.Nullable(t.Number()),
});

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
  shareExpiresAt: t.Nullable(t.String()),
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

export const SubtreeIssueResponse = t.Composite([
  IssueRefResponse,
  t.Object({ parentId: t.Number() }),
]);

export const subtreeQuery = t.Object({
  ids: t.String({ description: 'CSV of issue ids.' }),
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
const issueLinkKind = (description?: string) =>
  t.Union(
    [
      t.Literal('blocks'),
      t.Literal('blocked_by'),
      t.Literal('relates'),
      t.Literal('duplicates'),
      t.Literal('duplicated_by'),
    ],
    { description },
  );

export const IssueLinkKindSchema = issueLinkKind();

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
      "'cascade' does the same to the subtasks. 'detach' makes " +
      "them ordinary issues. 'reassign' moves them to newParentId.",
  },
);

export const NewParentIdSchema = t.Integer({
  description: "Issue id the subtasks move to. Required for 'reassign'.",
});

// The estimate a create or an update sets. Time arrives as whole minutes: the
// hours-and-minutes field is the UI's, and it sends what it parsed.
export const EstimatePointsSchema = t.Nullable(
  t.Number({ minimum: 0, description: 'Story points, or null to clear.' }),
);

export const EstimateMinutesSchema = t.Nullable(
  t.Integer({ minimum: 0, description: 'Estimate in minutes, or null to clear.' }),
);

// IssueWatcherRow from watchers.ts: one member following the issue.
export const IssueWatcherResponse = t.Object({
  userId: t.String(),
  name: t.String(),
  image: t.Nullable(t.String()),
});

export const issueWatcherParams = t.Object({
  issueId: t.Numeric(),
  userId: t.String(),
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
});

export const ChecklistItemContentSchema = t.String({
  minLength: 1,
  maxLength: 500,
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
  minutes: t.Integer({ minimum: 1 }),
  spentOn: isoDate('Day of the work. Not in the future.'),
  note: t.Optional(
    t.Nullable(t.String({ maxLength: 500, description: 'What the time was for. One line.' })),
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
    ancestors: t.Array(IssueRefResponse, {
      description: `The issues above this one, from the top level down to its parent; empty for an issue with no parent. Subtasks nest at most ${MAX_SUBTASK_DEPTH} levels deep, so an issue with ${MAX_SUBTASK_DEPTH - 1} ancestors cannot have subtasks.`,
    }),
    checklists: t.Array(ChecklistResponse),
    development: t.Array(DevelopmentLinkResponse),
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
  parent: t.Nullable(t.Object({ id: t.Number(), identifier: t.String(), title: t.String() })),
  assigneeUserId: t.Nullable(t.String()),
  delegateUserId: t.Nullable(t.String()),
  priority: t.Nullable(t.String()),
  dueDate: t.Nullable(t.String()),
  estimatePoints: t.Nullable(t.Number()),
  estimateMinutes: t.Nullable(t.Number()),
  loggedMinutes: t.Number(),
  labelIds: t.Array(t.Number()),
  archived: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
  statusSince: t.String(),
  completedAt: t.Nullable(t.String()),
});

export const CrossProjectIssueHitResponse = t.Composite([
  IssueSearchHitResponse,
  t.Object({
    projectId: t.Number(),
    projectRef: t.String(),
    projectKey: t.String(),
    projectName: t.String(),
    teamName: t.String(),
  }),
]);

// CommentReactionRow from reactions.ts: one emoji on a comment and who reacted with it.
export const CommentReactionResponse = t.Object({
  emoji: t.String(),
  users: t.Array(t.Object({ id: t.String(), name: t.String() })),
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
  editedAt: t.Nullable(t.String()),
  reactions: t.Array(CommentReactionResponse),
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

// Both feed routes page the same way: a limit and the previous page's cursor, over
// the entries the filter keeps, in the order asked for.
export const feedPageQuery = t.Object({
  limit: t.Optional(t.Numeric({ description: '1-100. Default 25.' })),
  cursor: t.Optional(t.String({ description: 'nextCursor from the previous page.' })),
  filter: t.Optional(
    t.Union([t.Literal('comments'), t.Literal('history'), t.Literal('worklog')], {
      description: "'history' is the change log without time entries. Omit for all entries.",
    }),
  ),
  order: t.Optional(
    t.Union([t.Literal('desc'), t.Literal('asc')], {
      description: "Default 'desc', newest first.",
    }),
  ),
});

// FeedCounts from activity.ts: how many entries each feed filter keeps.
export const FeedCountsResponse = t.Object({
  all: t.Number(),
  comments: t.Number(),
  history: t.Number(),
  worklog: t.Number(),
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
  typeId: t.Optional(t.Nullable(t.Integer({ description: 'Issue type id from get_project.' }))),
  initiativeId: t.Optional(
    t.Nullable(
      t.Integer({
        description: 'Initiative id from list_initiatives.',
      }),
    ),
  ),
  cycleId: t.Optional(
    t.Nullable(
      t.Integer({
        description: 'Cycle id from list_cycles. A completed cycle is refused.',
      }),
    ),
  ),
  assigneeUserId: t.Optional(
    t.Nullable(
      t.String({
        description: "User id from get_project.assignees with kind 'member'.",
      }),
    ),
  ),
  delegateUserId: t.Optional(
    t.Nullable(
      t.String({
        description: "Agent user id from get_project.assignees with kind 'agent'.",
      }),
    ),
  ),
  columnId: t.Integer({ description: 'Column id from get_project.columns.' }),
  parentId: t.Optional(
    t.Nullable(
      t.Integer({
        description: `Parent issue id, to make this issue a subtask. The parent must be in this project. Subtasks nest at most ${MAX_SUBTASK_DEPTH} levels deep.`,
      }),
    ),
  ),
  title: t.String({ minLength: 1 }),
  description: t.Optional(
    t.String({
      maxLength: ISSUE_TEXT_LIMIT,
      description: 'Plain text or markdown.',
    }),
  ),
  priority: t.Optional(t.Nullable(t.String({ description: 'urgent, high, medium or low.' }))),
  estimatePoints: t.Optional(EstimatePointsSchema),
  estimateMinutes: t.Optional(EstimateMinutesSchema),
  startDate: t.Optional(t.Nullable(isoDate())),
  dueDate: t.Optional(t.Nullable(isoDate())),
  labelIds: t.Optional(t.Array(t.Integer(), { description: 'Label ids from get_project.labels.' })),
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
    startDate: t.Optional(t.Nullable(isoDate())),
    dueDate: t.Optional(t.Nullable(isoDate())),
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
      description: 'Text to find in the title, description, issue number or custom field text.',
    }),
  ),
  limit: t.Optional(t.Numeric({ description: '1-500. Default 50.' })),
});

export const searchAllIssuesQuery = t.Object({
  q: t.String({
    minLength: 1,
    description:
      'Text to find in the title, description, issue ' +
      'number ("KEY-42" or a number) or custom field text.',
  }),
  limit: t.Optional(t.Numeric({ description: '1-50. Default 20.' })),
  perProjectLimit: t.Optional(
    t.Numeric({ description: 'Max results per project, 1-50. Default 5.' }),
  ),
  excludeProjectId: t.Optional(t.Numeric({ description: "Leave out this project's issues." })),
});

export const listIssuesQuery = t.Object({
  columnId: t.Optional(t.Numeric()),
  typeId: t.Optional(t.Numeric()),
  initiativeId: t.Optional(t.Numeric()),
  cycleId: t.Optional(t.Numeric()),
  parentId: t.Optional(t.Numeric({ description: 'Lists the subtasks of this issue.' })),
  assigneeUserId: t.Optional(t.String()),
  delegateUserId: t.Optional(t.String()),
  priority: t.Optional(t.String()),
  labelIds: t.Optional(
    t.String({ description: 'Comma-separated label ids. The issue must have all of them.' }),
  ),
  dueFrom: t.Optional(t.String({ description: "Due on or after 'YYYY-MM-DD'." })),
  dueTo: t.Optional(t.String({ description: "Due on or before 'YYYY-MM-DD'." })),
  createdFrom: instantQuery('Created at or after this'),
  createdTo: instantQuery('Created before this'),
  updatedFrom: instantQuery('Updated at or after this'),
  updatedTo: instantQuery('Updated before this'),
  blocked: t.Optional(
    t.String({
      description:
        "'true' lists issues blocked by an open issue (not completed, canceled or archived).",
    }),
  ),
  includeArchived: t.Optional(t.String({ description: "'true' includes archived issues." })),
  limit: t.Optional(t.Numeric({ description: '1-500. Default 50.' })),
});

export const listAllIssuesQuery = t.Composite([
  t.Pick(listIssuesQuery, [
    'assigneeUserId',
    'delegateUserId',
    'priority',
    'dueFrom',
    'dueTo',
    'createdFrom',
    'createdTo',
    'updatedFrom',
    'updatedTo',
    'includeArchived',
    'limit',
  ]),
  t.Object({
    cycleIds: t.Optional(
      t.String({ description: 'Comma-separated cycle ids. Matches issues in any of them.' }),
    ),
    parentIds: t.Optional(
      t.String({ description: 'Comma-separated parent issue ids. Lists their subtasks.' }),
    ),
    stateTypes: t.Optional(
      t.String({
        description:
          'Comma-separated state types: backlog, unstarted, started, completed, canceled. ' +
          "'backlog,unstarted,started' lists open issues.",
      }),
    ),
  }),
]);

export const issueSequenceParams = t.Object({
  projectKey: t.String(),
  sequenceNumber: t.Numeric(),
});

export const moveIssueBody = t.Object({
  projectId: t.Integer({
    description: 'Target project id from list_projects, in the same team.',
  }),
  columnId: t.Optional(
    t.Integer({
      description:
        'Column id in the target project, from get_project. ' +
        'Omit to use the column with the same name or state type.',
    }),
  ),
});

export const updateIssueBody = t.Object({
  columnId: t.Optional(t.Integer({ description: 'Column id to move the issue to.' })),
  position: t.Optional(t.Number({ description: 'Position in the column.' })),
  typeId: t.Optional(t.Nullable(t.Integer())),
  parentId: t.Optional(
    t.Nullable(
      t.Integer({
        description: `Parent issue id, or null to detach. The parent must be in this project and must not be this issue or its subtask. The issue and its subtasks must stay within ${MAX_SUBTASK_DEPTH} levels.`,
      }),
    ),
  ),
  initiativeId: t.Optional(
    t.Nullable(
      t.Integer({
        description: 'Initiative id from list_initiatives, or null to unlink.',
      }),
    ),
  ),
  cycleId: t.Optional(
    t.Nullable(
      t.Integer({
        description: 'Cycle id from list_cycles, or null to remove. A completed cycle is refused.',
      }),
    ),
  ),
  assigneeUserId: t.Optional(
    t.Nullable(t.String({ description: 'Project member user id, or null to unassign.' })),
  ),
  delegateUserId: t.Optional(
    t.Nullable(t.String({ description: 'AI agent user id, or null to remove.' })),
  ),
  title: t.Optional(t.String({ minLength: 1 })),
  description: t.Optional(t.String({ maxLength: ISSUE_TEXT_LIMIT })),
  priority: t.Optional(t.Nullable(t.String({ description: 'urgent, high, medium or low.' }))),
  estimatePoints: t.Optional(EstimatePointsSchema),
  estimateMinutes: t.Optional(EstimateMinutesSchema),
  startDate: t.Optional(t.Nullable(isoDate())),
  dueDate: t.Optional(t.Nullable(isoDate())),
  labelIds: t.Optional(t.Array(t.Integer(), { description: 'Replaces all labels.' })),
});

export const subtaskDispositionQuery = t.Object({
  subtasks: t.Optional(SubtaskModeSchema),
  newParentId: t.Optional(t.Numeric(NewParentIdSchema)),
});

export const setIssueFieldValueBody = t.Object({
  value: t.Optional(
    t.Nullable(t.Union([t.String({ maxLength: ISSUE_TEXT_LIMIT }), t.Number(), t.Boolean()])),
  ),
  valueEnd: t.Optional(t.Nullable(t.String())),
  optionIds: t.Optional(t.Array(t.Integer())),
});

export const issueFieldParams = t.Object({ issueId: t.Numeric(), fieldId: t.Numeric() });

export const addIssueLinkBody = t.Object({
  targetIssueId: t.Integer({
    description: 'Id of the other issue.',
  }),
  kind: issueLinkKind('Relation from issueId to targetIssueId.'),
});

export const issueLinkParams = t.Object({ issueId: t.Numeric(), linkId: t.Numeric() });

export const checklistTitleBody = t.Object({ title: ChecklistTitleSchema });

export const createChecklistItemBody = t.Object({ content: ChecklistItemContentSchema });

export const createChecklistItemsBody = t.Object({
  items: t.Array(createChecklistItemBody, { minItems: 1, maxItems: 100 }),
});

export const updateChecklistItemBody = t.Object({
  content: t.Optional(ChecklistItemContentSchema),
  done: t.Optional(t.Boolean()),
});

export const feedRangeQuery = t.Object({
  from: t.String({ description: 'Start of the stretch (ISO datetime), inclusive.' }),
  to: t.Optional(
    t.String({ description: 'End of the stretch (ISO datetime), exclusive. Open-ended.' }),
  ),
});

const commentText = t.String({
  minLength: 1,
  maxLength: ISSUE_TEXT_LIMIT,
});

export const createCommentBody = t.Object({
  body: commentText,
  replyToId: t.Optional(t.Number({ description: 'Reply to this comment of the same issue.' })),
});

export const updateCommentBody = t.Object({
  body: commentText,
});

export const commentParams = t.Object({
  commentId: t.Numeric(),
});

// The service checks that the text is one emoji; the length bounds it before that.
const reactionEmoji = t.String({
  minLength: 1,
  maxLength: 64,
  description: 'One emoji, such as 👍 or ✅.',
});

export const addReactionBody = t.Object({ emoji: reactionEmoji });

export const reactionParams = t.Object({
  commentId: t.Numeric(),
  emoji: reactionEmoji,
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

export const issueAgentRunsQuery = t.Object({
  before: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50, multipleOf: 1, default: 25 })),
});

export const issueAgentRunParams = t.Object({
  issueId: t.Numeric(),
  runId: t.Numeric(),
});

export const IssueAgentRunPageResponse = t.Object({
  items: t.Array(
    t.Object({
      id: t.Number(),
      agentId: t.Number(),
      username: t.String(),
      kind: t.String(),
      status: t.String(),
      executionState: agentExecutionState,
      trigger: t.String(),
      prompt: t.String(),
      output: t.Nullable(t.String()),
      attempts: t.Number(),
      lastError: t.Nullable(t.String()),
      contextTokens: t.Optional(t.Number()),
      createdAt: t.String(),
      startedAt: t.Nullable(t.String()),
      finishedAt: t.Nullable(t.String()),
      nextAttemptAt: t.String(),
    }),
  ),
  nextCursor: t.Nullable(t.Number()),
});

export const issueAgentTraceQuery = t.Object({
  traceId: t.Optional(t.String({ minLength: 1, maxLength: 128 })),
});

export const IssueAgentRunTraceResponse = t.Nullable(
  t.Object({
    ...AgentTraceDetailResponse.properties,
    previousTraceId: t.Nullable(t.String()),
    attempt: t.Number({
      description: 'The place of this attempt among the recorded ones, oldest 1.',
    }),
    attempts: t.Number({ description: 'How many attempts of the run recorded a trace.' }),
  }),
);
