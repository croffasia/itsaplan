import { t } from 'elysia';

export const dashboardParams = t.Object({ dashboardId: t.Numeric() });

// A dashboard DTO (DashboardRow from the service). layout is a jsonb blob owned by
// the UI and returned verbatim, so it is typed as t.Any().
export const DashboardResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  icon: t.Nullable(t.String()),
  layout: t.Any(),
  position: t.Number(),
  createdAt: t.String(),
});

export const DashboardListResponse = t.Array(DashboardResponse);

export const createDashboardBody = t.Object({
  name: t.String({ minLength: 1 }),
  icon: t.Optional(t.Nullable(t.String())),
  layout: t.Optional(t.Any()),
});

export const updateDashboardBody = t.Partial(createDashboardBody);

export const reorderDashboardsBody = t.Object({
  orderedIds: t.Array(t.Integer(), { minItems: 1 }),
});
