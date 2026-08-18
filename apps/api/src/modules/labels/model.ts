import { t } from 'elysia';

export const labelParams = t.Object({ projectKey: t.String(), labelId: t.Numeric() });
export const labelGroupParams = t.Object({ projectKey: t.String(), groupId: t.Numeric() });

// A label DTO (LabelRow from the service).
export const LabelResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  groupId: t.Nullable(t.Number()),
  name: t.String(),
  color: t.String(),
});

// A label group DTO (LabelGroupRow from the service).
export const LabelGroupResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  color: t.String(),
});

export const createLabelBody = t.Object({
  name: t.String({ minLength: 1 }),
  color: t.Optional(t.String()),
  groupId: t.Optional(t.Nullable(t.Integer())),
});

export const updateLabelBody = t.Partial(createLabelBody);

export const createLabelGroupBody = t.Object({
  name: t.String({ minLength: 1 }),
  color: t.Optional(t.String()),
});

export const updateLabelGroupBody = t.Partial(createLabelGroupBody);
