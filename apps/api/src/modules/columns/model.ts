import { t } from 'elysia';

const stateType = t.Union([
  t.Literal('backlog'),
  t.Literal('unstarted'),
  t.Literal('started'),
  t.Literal('completed'),
  t.Literal('canceled'),
]);

export const columnParams = t.Object({ projectKey: t.String(), columnId: t.Numeric() });

export const ColumnResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  stateType: t.String(),
  color: t.String(),
  position: t.Number(),
  wipLimit: t.Union([t.Number(), t.Null()]),
  wipMode: t.String(),
  autoAssignUserId: t.Union([t.String(), t.Null()]),
});

export const ColumnListResponse = t.Array(ColumnResponse);

export const createColumnBody = t.Object({
  name: t.String({ minLength: 1 }),
  stateType,
  color: t.Optional(t.String()),
  wipLimit: t.Optional(
    t.Nullable(
      t.Integer({
        minimum: 1,
        description:
          'How many issues this column should hold. null for no limit. ' +
          'Enforced only when wipMode is "hard".',
      }),
    ),
  ),
  wipMode: t.Optional(
    t.Union([t.Literal('soft'), t.Literal('hard')], {
      description:
        'What happens at wipLimit: "soft" only warns on the board, ' +
        '"hard" refuses an issue entering a full column with a 409.',
    }),
  ),
  autoAssignUserId: t.Optional(
    t.Nullable(
      t.String({
        description:
          'A project member every issue entering this column is assigned to, ' +
          'replacing its current assignee. null for no automatic assignment.',
      }),
    ),
  ),
});

export const updateColumnBody = t.Partial(createColumnBody);

export const reorderColumnsBody = t.Object({
  orderedIds: t.Array(t.Integer(), { minItems: 1 }),
});

export const deleteColumnBody = t.Union([
  t.Object({ mode: t.Literal('move'), targetColumnId: t.Integer() }),
  t.Object({ mode: t.Literal('delete') }),
]);
