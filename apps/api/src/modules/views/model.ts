import { t } from 'elysia';

export const viewParams = t.Object({ viewId: t.Numeric() });

export const createViewBody = t.Object({
  name: t.String({ minLength: 1 }),
  icon: t.Optional(t.Nullable(t.String())),
  filters: t.Optional(t.Any()),
  display: t.Optional(t.Any()),
});

export const updateViewBody = t.Partial(createViewBody);

export const reorderViewsBody = t.Object({
  orderedIds: t.Array(t.Integer(), { minItems: 1 }),
});

export const ViewResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  icon: t.Nullable(t.String()),
  filters: t.Any(),
  display: t.Any(),
  position: t.Number(),
  shareToken: t.Nullable(t.String()),
  shareExtended: t.Boolean(),
  favorite: t.Boolean(),
  createdAt: t.String(),
});
