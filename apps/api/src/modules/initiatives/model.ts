import { t } from 'elysia';
import { isoDate } from '#shared/schemas';
import { pageQueryFields, pageResponse } from '#shared/pagination';
import { ActivityPayloadResponse } from '#shared/activity';

// The initiative lifecycle enum, validated at the edge so an invalid value is a
// 400 (not a Postgres CHECK violation → 500). Mirrors the DB check constraint.
const InitiativeStatus = t.Union([
  t.Literal('proposed'),
  t.Literal('planned'),
  t.Literal('active'),
  t.Literal('completed'),
  t.Literal('canceled'),
]);

export const initiativeParams = t.Object({ initiativeId: t.Numeric() });

export const listInitiativesQuery = t.Object({
  status: t.Optional(
    t.String({
      description: 'Comma-separated: proposed, planned, active, completed, canceled. Omit for all.',
    }),
  ),
  search: t.Optional(t.String({ description: 'Matches the title.' })),
  sort: t.Optional(
    t.Union(
      [t.Literal('title'), t.Literal('priority'), t.Literal('targetDate'), t.Literal('owner')],
      { description: 'Omit for the manual order.' },
    ),
  ),
  dir: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')], { description: 'Default asc.' })),
  ...pageQueryFields,
});

export const initiativeOptionsQuery = t.Object({
  search: t.Optional(t.String({ description: 'Match by title.' })),
  include: t.Optional(
    t.Numeric({ description: 'Keep this initiative in the list even when it is closed.' }),
  ),
});

export const initiativeFeedQuery = t.Object({
  limit: t.Optional(t.String({ description: '1-100. Default 25.' })),
  cursor: t.Optional(t.String({ description: 'nextCursor from the previous page.' })),
});

// InitiativeRow from the service. progress is derived issue counts; health is
// computed on the fly (on_track/at_risk/off_track, or null when there is nothing
// to judge).
export const InitiativeResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  title: t.String(),
  description: t.String(),
  status: t.String(),
  ownerUserId: t.Nullable(t.String()),
  priority: t.Nullable(t.String()),
  startDate: t.Nullable(t.String()),
  targetDate: t.Nullable(t.String()),
  position: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String(),
  labelIds: t.Array(t.Number()),
  progress: t.Object({ completed: t.Number(), canceled: t.Number(), total: t.Number() }),
  health: t.Nullable(t.String()),
  favorite: t.Boolean(),
});

export const InitiativePageResponse = pageResponse(InitiativeResponse);

export const InitiativeOptionListResponse = t.Array(
  t.Object({ id: t.Number(), title: t.String(), status: t.String() }),
);

export const InitiativeCountsResponse = t.Object({
  total: t.Number(),
  proposed: t.Number(),
  planned: t.Number(),
  active: t.Number(),
  completed: t.Number(),
  canceled: t.Number(),
});

// InitiativeFeedItemRow from activity.ts: one timeline entry, from the initiative
// itself (source 'initiative') or a linked issue (source 'issue').
const FeedItemResponse = t.Object({
  id: t.Number(),
  source: t.String(),
  kind: t.String(),
  actorUserId: t.Nullable(t.String()),
  actorName: t.Nullable(t.String()),
  body: t.Nullable(t.String()),
  action: t.Nullable(t.String()),
  payload: ActivityPayloadResponse,
  createdAt: t.String(),
  issueId: t.Nullable(t.Number()),
  issueIdentifier: t.Nullable(t.String()),
});

export const FeedPageResponse = t.Object({
  items: t.Array(FeedItemResponse),
  nextCursor: t.Nullable(t.Object({ ts: t.String(), id: t.Number() })),
});

export const createInitiativeBody = t.Object({
  title: t.String({ minLength: 1 }),
  description: t.Optional(t.String()),
  status: t.Optional(InitiativeStatus),
  ownerUserId: t.Optional(t.Nullable(t.String({ description: 'Project member user id.' }))),
  priority: t.Optional(t.Nullable(t.String({ description: 'urgent, high, medium or low.' }))),
  startDate: t.Optional(t.Nullable(isoDate())),
  targetDate: t.Optional(t.Nullable(isoDate())),
  labelIds: t.Optional(t.Array(t.Integer(), { description: 'Label ids from get_project.labels.' })),
});

export const updateInitiativeBody = t.Partial(createInitiativeBody);
