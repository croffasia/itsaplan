import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards, entityGuard } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { mcpTool } from '#mcp/generate';
import { accessErrors, commonErrors } from '#shared/responses';
import {
  DashboardListResponse,
  DashboardResponse,
  createDashboardBody,
  dashboardParams,
  reorderDashboardsBody,
  updateDashboardBody,
} from './model';
import {
  listDashboards,
  createDashboard,
  getDashboard,
  updateDashboard,
  deleteDashboard,
  reorderDashboards,
} from './service';

export const dashboardRoutes = new Elysia({ name: 'dashboards', detail: { tags: ['Dashboards'] } })
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
      response: { 200: DashboardListResponse, ...accessErrors },
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
      body: createDashboardBody,
      permission: ['dashboards', 'create'],
      response: { 201: DashboardResponse, ...commonErrors },
      detail: { summary: 'Create a dashboard', ...mcpTool('create_dashboard') },
    },
  )

  .put(
    '/projects/:projectKey/dashboards/reorder',
    async ({ project, body }) => {
      return reorderDashboards(project.id, body.orderedIds);
    },
    {
      body: reorderDashboardsBody,
      permission: ['dashboards', 'edit'],
      response: { 200: DashboardListResponse, ...commonErrors },
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
      body: updateDashboardBody,
      params: dashboardParams,
      dashboard: 'edit',
      response: { 200: DashboardResponse, ...commonErrors },
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
      response: { 204: t.Void(), ...commonErrors },
      detail: { summary: 'Delete a dashboard', ...mcpTool('delete_dashboard') },
    },
  );
