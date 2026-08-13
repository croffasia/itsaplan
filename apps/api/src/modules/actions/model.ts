import { t } from 'elysia';

export const ActionResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  icon: t.String(),
  condition: t.Any(),
  effect: t.Any(),
  position: t.Number(),
  createdAt: t.String(),
});

export const ActionListResponse = t.Array(ActionResponse);

export const actionParams = t.Object({ actionId: t.Numeric() });

export const createActionBody = t.Object({
  name: t.String({ minLength: 1 }),
  icon: t.Optional(t.String()),
  condition: t.Optional(t.Any()),
  effect: t.Optional(t.Any()),
});

export const updateActionBody = t.Partial(createActionBody);

export const reorderActionsBody = t.Object({
  orderedIds: t.Array(t.Integer(), { minItems: 1 }),
});
