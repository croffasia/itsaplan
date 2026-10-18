import { t } from 'elysia';
import { pageQueryFields, pageResponse } from '#shared/pagination';

export const agentActionsQuery = t.Object({
  projectId: t.Optional(t.Numeric({ description: 'Only the actions in this project.' })),
  from: t.Optional(
    t.String({ format: 'date-time', description: 'Only the actions at or after this time.' }),
  ),
  to: t.Optional(
    t.String({ format: 'date-time', description: 'Only the actions before this time.' }),
  ),
  ...pageQueryFields,
});

export const pendingActionsQuery = t.Object({
  status: t.Optional(
    t.Union([
      t.Literal('pending'),
      t.Literal('applying'),
      t.Literal('approved'),
      t.Literal('rejected'),
      t.Literal('failed'),
      t.Literal('expired'),
    ]),
  ),
  ...pageQueryFields,
});

export const pendingActionParams = t.Object({ actionId: t.Numeric() });

export const issueIdParams = t.Object({ issueId: t.Numeric() });

export const rejectBody = t.Object({
  reason: t.String({ minLength: 1, maxLength: 2000, description: 'Why the call is rejected.' }),
});

export const AgentActionResponse = t.Object({
  id: t.Number(),
  tool: t.String(),
  args: t.Any(),
  status: t.Union([t.Literal('success'), t.Literal('failed')]),
  error: t.Nullable(t.String()),
  projectId: t.Number(),
  issueId: t.Nullable(t.Number()),
  issueKey: t.Nullable(t.String()),
  issueTitle: t.Nullable(t.String()),
  runId: t.Nullable(t.Number()),
  approvedByUserId: t.Nullable(t.String()),
  approvedByName: t.Nullable(t.String()),
  createdAt: t.String(),
});

export const AgentActionPageResponse = pageResponse(AgentActionResponse);

export const PendingActionResponse = t.Object({
  id: t.Number(),
  agentId: t.Number(),
  agentName: t.String(),
  projectId: t.Number(),
  issueId: t.Nullable(t.Number()),
  runId: t.Nullable(t.Number()),
  tool: t.String(),
  args: t.Any(),
  status: t.Union([
    t.Literal('pending'),
    t.Literal('applying'),
    t.Literal('approved'),
    t.Literal('rejected'),
    t.Literal('failed'),
    t.Literal('expired'),
  ]),
  reason: t.Nullable(t.String()),
  result: t.Nullable(t.String()),
  decidedByUserId: t.Nullable(t.String()),
  decidedAt: t.Nullable(t.String()),
  createdAt: t.String(),
});

export const PendingActionPageResponse = pageResponse(PendingActionResponse);
