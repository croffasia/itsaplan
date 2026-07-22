import { Elysia, t } from 'elysia';
import { noContent } from '../shared/http';
import { guards, entityGuard } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { HttpError } from '../shared/lib';
import { mcpTool } from '../mcp/generate';
import { ErrorResponse } from '../shared/responses';
import {
  listDashboards,
  createDashboard,
  getDashboard,
  updateDashboard,
  deleteDashboard,
  reorderDashboards,
} from './store';

const dashboardParams = t.Object({ dashboardId: t.Numeric() });

// A dashboard DTO (DashboardRow from the store). layout is a jsonb blob owned by
// the UI and returned verbatim, so it is typed as t.Any().
const DashboardResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  icon: t.Nullable(t.String()),
  layout: t.Any(),
  position: t.Number(),
  createdAt: t.String(),
});

export const dashboardRoutes = new Elysia({
  name: 'dashboards',
  detail: { tags: ['Dashboards'] },
})
  .use(authContext)
  .use(guards)
  // Guard for routes that address a dashboard by its own id (no :projectKey in
  // the path). Set `dashboard: "<action>"` in the route options.
  .macro({
    dashboard: entityGuard(
      'dashboards',
      'Dashboard not found',
      async (p) => (await getDashboard(Number(p.dashboardId)))?.projectId ?? null,
    ),
  })
  .get(
    '/projects/:projectKey/dashboards',
    async ({ project }) => {
      return listDashboards(project.id);
    },
    {
      permission: ['dashboards', 'read'],
      response: {
        200: t.Array(DashboardResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: "List a project's dashboards", ...mcpTool('list_dashboards') },
    },
  )

  .post(
    '/projects/:projectKey/dashboards',
    async ({ project, body, set }) => {
      set.status = 201;
      return createDashboard({ projectId: project.id, ...body });
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        icon: t.Optional(t.Nullable(t.String())),
        layout: t.Optional(t.Any()),
      }),
      permission: ['dashboards', 'create'],
      response: {
        201: DashboardResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Create a dashboard', ...mcpTool('create_dashboard') },
    },
  )

  // Sets the tab order to orderedIds.
  .put(
    '/projects/:projectKey/dashboards/reorder',
    async ({ project, body }) => {
      return reorderDashboards(project.id, body.orderedIds);
    },
    {
      body: t.Object({ orderedIds: t.Array(t.Integer(), { minItems: 1 }) }),
      permission: ['dashboards', 'edit'],
      response: {
        200: t.Array(DashboardResponse),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Reorder dashboards', ...mcpTool('reorder_dashboards') },
    },
  )

  .patch(
    '/dashboards/:dashboardId',
    async ({ params, body }) => {
      const dashboard = await updateDashboard(params.dashboardId, body);
      if (!dashboard) throw new HttpError(404, 'Dashboard not found');
      return dashboard;
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        icon: t.Optional(t.Nullable(t.String())),
        layout: t.Optional(t.Any()),
      }),
      params: dashboardParams,
      dashboard: 'edit',
      response: {
        200: DashboardResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Update a dashboard', ...mcpTool('update_dashboard') },
    },
  )

  .delete(
    '/dashboards/:dashboardId',
    async ({ params }) => {
      await deleteDashboard(params.dashboardId);
      return noContent();
    },
    {
      params: dashboardParams,
      dashboard: 'delete',
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Delete a dashboard', ...mcpTool('delete_dashboard') },
    },
  );
