import { getSchemaValidator, t } from 'elysia';
import { updateIssueBody } from '#modules/issues/model';

const actionEffect = t.Pick(
  updateIssueBody,
  ['columnId', 'assigneeUserId', 'priority', 'typeId', 'startDate', 'dueDate', 'labelIds'],
  { additionalProperties: false },
);

export const actionEffectValidator = getSchemaValidator(actionEffect);
export type ActionEffect = (typeof actionEffect)['static'];
export const applyActionBody = t.Object({ effect: actionEffect });

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
