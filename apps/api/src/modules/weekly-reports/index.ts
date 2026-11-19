import { Elysia } from 'elysia';
import { assertPermission, requireUser } from '#shared/access';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { commonErrors, errors } from '#shared/responses';
import {
  confirmWeeklyReport,
  SavedReport,
  WeeklyReportResponse,
  WeeklyReportSettingsResponse,
  weeklyReportSettings,
} from './model';
import {
  readWeeklyReport,
  readWeeklyReportSettings,
  saveWeeklyReport,
  writeWeeklyReportSettings,
} from './service';

export const weeklyReportRoutes = new Elysia({
  name: 'weekly-reports',
  detail: { tags: ['Weekly Reports'] },
})
  .use(authContext)
  .use(guards)
  .get(
    '/projects/:projectKey/settings/weekly-report',
    async ({ project }) => ({ settings: await readWeeklyReportSettings(project.id) }),
    {
      permission: ['workflow_config', 'read'],
      response: { 200: WeeklyReportSettingsResponse, ...commonErrors },
      detail: { summary: 'Get project weekly report settings' },
    },
  )
  .put(
    '/projects/:projectKey/settings/weekly-report',
    ({ project, body }) => writeWeeklyReportSettings(project.id, body),
    {
      permission: ['workflow_config', 'edit'],
      body: weeklyReportSettings,
      response: { 200: weeklyReportSettings, ...commonErrors },
      detail: { summary: 'Set project weekly report settings' },
    },
  )
  .get(
    '/projects/:projectKey/weekly-report',
    ({ project, user }) =>
      readWeeklyReport(project.id, requireUser(user).id, () =>
        assertPermission(project.id, user, 'work_items', 'read'),
      ),
    {
      permission: ['documents', 'read'],
      feature: 'documents',
      response: { 200: WeeklyReportResponse, ...commonErrors },
      detail: { summary: 'Preview or open this week’s report' },
    },
  )
  .post(
    '/projects/:projectKey/weekly-report',
    async ({ project, user, body }) => {
      await assertPermission(project.id, user, 'documents', 'read');
      await assertPermission(project.id, user, 'work_items', 'read');
      return saveWeeklyReport(project.id, requireUser(user).id, body.token);
    },
    {
      permission: ['documents', 'create'],
      feature: 'documents',
      body: confirmWeeklyReport,
      response: { 200: SavedReport, ...commonErrors, ...errors(409) },
      detail: { summary: 'Save this week’s report as a Docs snapshot' },
    },
  );
