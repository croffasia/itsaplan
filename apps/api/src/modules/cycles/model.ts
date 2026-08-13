import { t } from 'elysia';

const IsoDate = t.String({
  pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  description: "Date 'YYYY-MM-DD'.",
});

export const cycleParams = t.Object({ cycleId: t.Numeric() });

export const listCyclesQuery = t.Object({
  status: t.Optional(
    t.Literal('planned', {
      description: 'Only the cycles that have not finished: active and upcoming.',
    }),
  ),
});

export const completedCyclesQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, description: '1-based page. Default 1.' })),
  pageSize: t.Optional(
    t.Numeric({ minimum: 1, maximum: 100, description: 'Items per page (1-100). Default 25.' }),
  ),
});

// CycleRow from the service. status follows from the dates against today (upcoming /
// active / completed) and progress is derived issue counts; neither is stored.
export const CycleResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  goal: t.String(),
  startDate: t.String(),
  endDate: t.String(),
  status: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
  progress: t.Object({ completed: t.Number(), canceled: t.Number(), total: t.Number() }),
});

export const CycleListResponse = t.Array(CycleResponse);

export const CyclePageResponse = t.Object({
  items: CycleListResponse,
  total: t.Number(),
  page: t.Number(),
  pageSize: t.Number(),
});

export const CycleOptionListResponse = t.Array(
  t.Object({ id: t.Number(), name: t.String(), status: t.String() }),
);

export const createCycleBody = t.Object({
  name: t.String({ minLength: 1, description: 'Cycle name.' }),
  goal: t.Optional(t.String({ description: 'What the team commits to in this cycle.' })),
  startDate: IsoDate,
  endDate: IsoDate,
});

export const updateCycleBody = t.Partial(createCycleBody);

export const transferCycleBody = t.Object({
  targetCycleId: t.Nullable(
    t.Integer({
      description: 'Cycle to move the unfinished issues to, or null to leave them without a cycle.',
    }),
  ),
});

export const TransferCycleResponse = t.Object({ moved: t.Number() });
