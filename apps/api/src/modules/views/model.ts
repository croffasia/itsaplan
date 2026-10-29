import { t } from 'elysia';

export const viewParams = t.Object({ viewId: t.Numeric() });

export const createViewBody = t.Object({
  name: t.String({ minLength: 1 }),
  icon: t.Optional(t.Nullable(t.String())),
  filters: t.Optional(t.Any()),
  display: t.Optional(t.Any()),
  isPrivate: t.Optional(
    t.Boolean({
      description:
        'Seen only by its creator, not even by the project owners. Anyone who can read the views of the project may create one. Defaults to false.',
    }),
  ),
});

// Privacy is not updated: a private view is added to the project by publishing it, and a
// project's view never turns private.
export const updateViewBody = t.Partial(t.Omit(createViewBody, ['isPrivate']));

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
  isPrivate: t.Boolean(),
  favorite: t.Boolean(),
  createdAt: t.String(),
});
