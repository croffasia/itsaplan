import type { DashboardLayout } from '@/utils/dashboardWidgets';
import { request } from '@/lib/api/core/client';

// A saved dashboard: the analytics counterpart of a View. `layout` is the ordered
// list of widgets (owned by the UI, stored verbatim server-side as jsonb).
export interface Dashboard {
  id: number;
  projectId: number;
  name: string;
  icon: string | null;
  layout: DashboardLayout;
  position: number;
  createdAt: string;
}

export interface NewDashboardInput {
  name: string;
  icon?: string | null;
  layout?: DashboardLayout;
}

export interface DashboardPatch {
  name?: string;
  icon?: string | null;
  layout?: DashboardLayout;
}

// Dashboards — same CRUD shape as views: collection ops take projectKey, ops on
// a single dashboard take its own id and hit /dashboards/:id.
export const listDashboards = (projectKey: string) =>
  request<Dashboard[]>(`/projects/${projectKey}/dashboards`);

export const createDashboard = (projectKey: string, input: NewDashboardInput) =>
  request<Dashboard>(`/projects/${projectKey}/dashboards`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateDashboard = (dashboardId: number, patch: DashboardPatch) =>
  request<Dashboard>(`/dashboards/${dashboardId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteDashboard = (dashboardId: number) =>
  request<void>(`/dashboards/${dashboardId}`, { method: 'DELETE' });

export const reorderDashboards = (projectKey: string, orderedIds: number[]) =>
  request<Dashboard[]>(`/projects/${projectKey}/dashboards/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
