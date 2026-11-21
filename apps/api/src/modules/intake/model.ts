import { t } from 'elysia';
import { pageQueryFields, pageResponse } from '#shared/pagination';
import { IssueResponse } from '#modules/issues/model';

export const INTAKE_STATUSES = ['pending', 'snoozed', 'accepted', 'declined', 'duplicate'] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

const priority = t.Nullable(
  t.Union([t.Literal('urgent'), t.Literal('high'), t.Literal('medium'), t.Literal('low')]),
);

const dateString = t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' });

export const projectParams = t.Object({ projectKey: t.String() });
export const intakeRequestParams = t.Object({ requestId: t.Numeric() });
export const intakeCommentParams = t.Object({ commentId: t.Numeric() });
export const intakeAttachmentPublicIdParams = t.Object({
  publicId: t.String({ format: 'uuid' }),
});

export const LinkedIssueSummaryResponse = t.Object({
  id: t.Number(),
  sequenceNumber: t.Number(),
  title: t.String(),
});

export const IntakeAttachmentResponse = t.Object({
  id: t.String(),
  filename: t.String(),
  contentType: t.String(),
  sizeBytes: t.Number(),
  createdAt: t.String(),
  url: t.String(),
});

export const IntakeAttachmentListResponse = t.Array(IntakeAttachmentResponse);

export const IntakeCommentResponse = t.Object({
  id: t.Number(),
  intakeRequestId: t.Number(),
  actorUserId: t.Nullable(t.String()),
  actorName: t.Nullable(t.String()),
  body: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const IntakeCommentListResponse = t.Array(IntakeCommentResponse);

export const IntakeRequestResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  title: t.String(),
  description: t.String(),
  priority,
  status: t.UnionEnum([...INTAKE_STATUSES]),
  source: t.String(),
  externalId: t.Nullable(t.String()),
  submittedByUserId: t.Nullable(t.String()),
  submittedByName: t.Nullable(t.String()),
  reviewedByUserId: t.Nullable(t.String()),
  reviewedByName: t.Nullable(t.String()),
  reviewedAt: t.Nullable(t.String()),
  declineReason: t.Nullable(t.String()),
  snoozedUntil: t.Nullable(t.String()),
  acceptedIssueId: t.Nullable(t.Number()),
  acceptedIssue: t.Nullable(LinkedIssueSummaryResponse),
  duplicateOfIssueId: t.Nullable(t.Number()),
  duplicateOfIssue: t.Nullable(LinkedIssueSummaryResponse),
  commentCount: t.Number(),
  attachmentCount: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const IntakeRequestPageResponse = pageResponse(IntakeRequestResponse);

export const IntakeRequestDetailResponse = t.Composite([
  IntakeRequestResponse,
  t.Object({
    comments: IntakeCommentListResponse,
    attachments: IntakeAttachmentListResponse,
  }),
]);

export const IntakeSummaryResponse = t.Object({
  pendingCount: t.Number(),
  snoozedCount: t.Number(),
  acceptedCount: t.Number(),
  declinedCount: t.Number(),
  duplicateCount: t.Number(),
  oldestPendingAt: t.Nullable(t.String()),
  oldestPendingAgeMs: t.Nullable(t.Number()),
});

export const listIntakeQuery = t.Object({
  status: t.Optional(
    t.UnionEnum([...INTAKE_STATUSES, 'all'], {
      description:
        "Filter by status. Default 'pending' (includes snoozed requests whose snooze date has passed).",
    }),
  ),
  source: t.Optional(t.String({ description: 'Filter by exact source name.' })),
  externalId: t.Optional(t.String({ description: 'Filter by exact external id.' })),
  q: t.Optional(t.String({ description: 'Case-insensitive search in title or description.' })),
  ...pageQueryFields,
});

export const createIntakeBody = t.Object({
  title: t.String({ minLength: 1, maxLength: 500 }),
  description: t.Optional(t.String()),
  priority: t.Optional(priority),
  source: t.Optional(
    t.String({
      minLength: 1,
      maxLength: 64,
      description:
        "Where the request came from (e.g. 'app', 'api', 'mcp', 'form', or a service name).",
    }),
  ),
  externalId: t.Optional(
    t.Nullable(
      t.String({
        minLength: 1,
        maxLength: 255,
        description: 'Optional caller-assigned id for deduplication within (project, source).',
      }),
    ),
  ),
  submittedByName: t.Optional(
    t.Nullable(
      t.String({
        maxLength: 200,
        description: 'Optional display name when filed on behalf of an external requester.',
      }),
    ),
  ),
});

export const updateIntakeBody = t.Object({
  title: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
  description: t.Optional(t.String()),
  priority: t.Optional(priority),
});

export const acceptIntakeBody = t.Optional(
  t.Object({
    assigneeUserId: t.Optional(t.Nullable(t.String())),
    dueDate: t.Optional(t.Nullable(dateString)),
    columnId: t.Optional(t.Integer({ minimum: 1 })),
    typeId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
    priority: t.Optional(priority),
  }),
);

export const AcceptIntakeResponse = t.Object({
  request: IntakeRequestResponse,
  issue: IssueResponse,
});

export const declineIntakeBody = t.Optional(
  t.Object({
    reason: t.Optional(
      t.Nullable(
        t.String({
          maxLength: 500,
          description: 'Optional one-line reason shown to the requester.',
        }),
      ),
    ),
  }),
);

export const snoozeIntakeBody = t.Object({
  until: t.String({
    minLength: 1,
    description: "Date ('YYYY-MM-DD') or ISO 8601 timestamp in the future to snooze until.",
  }),
});

export const duplicateIntakeBody = t.Object({
  issueId: t.Integer({ minimum: 1 }),
});

export const createIntakeCommentBody = t.Object({
  body: t.String({ minLength: 1, maxLength: 20_000 }),
});

export const uploadIntakeAttachmentBody = t.Object({
  file: t.File(),
});
