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
});

export const ColumnListResponse = t.Array(ColumnResponse);

export const createColumnBody = t.Object({
  name: t.String({ minLength: 1 }),
  stateType,
  color: t.Optional(t.String()),
});

export const updateColumnBody = t.Partial(createColumnBody);

export const reorderColumnsBody = t.Object({
  orderedIds: t.Array(t.Integer(), { minItems: 1 }),
});

export const deleteColumnBody = t.Union([
  t.Object({ mode: t.Literal('move'), targetColumnId: t.Integer() }),
  t.Object({ mode: t.Literal('delete') }),
]);
