import { t } from 'elysia';

const visibility = t.Union([t.Literal('public'), t.Literal('private'), t.Literal('restricted')]);

export const noteBoardParams = t.Object({ projectKey: t.String(), boardId: t.Numeric() });

// A note board DTO (NoteBoardRow from the service). canvas is a jsonb blob owned by
// the UI (React Flow nodes/edges) and returned verbatim, so it is typed t.Any().
export const NoteBoardResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  ownerUserId: t.Nullable(t.String()),
  createdByUserId: t.Nullable(t.String()),
  visibility,
  memberIds: t.Array(t.String()),
  name: t.String(),
  canvas: t.Any(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

// What the board switcher lists (NoteBoardSummary from the service).
export const NoteBoardSummaryListResponse = t.Array(
  t.Omit(NoteBoardResponse, ['canvas', 'memberIds']),
);

export const NoteBoardAccessCandidateListResponse = t.Array(
  t.Object({
    userId: t.String(),
    name: t.String(),
    image: t.Nullable(t.String()),
    kind: t.Union([t.Literal('member'), t.Literal('agent')]),
    canAccess: t.Boolean(),
  }),
);

export const listNoteBoardsQuery = t.Object({
  q: t.Optional(t.String()),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
  offset: t.Optional(t.Numeric({ minimum: 0 })),
});

// A board is created public or private; it turns restricted by granting members,
// which only the update route does.
export const createNoteBoardBody = t.Object({
  name: t.String({ minLength: 1 }),
  visibility: t.Optional(t.Union([t.Literal('public'), t.Literal('private')])),
  canvas: t.Optional(t.Any()),
});

export const updateNoteBoardBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  canvas: t.Optional(t.Any()),
  visibility: t.Optional(visibility),
  memberIds: t.Optional(t.Array(t.String())),
});
