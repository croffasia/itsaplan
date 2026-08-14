import { Elysia } from 'elysia';
import { HttpError, pgErrorCode } from './shared/lib';
import { authContext } from './shared/auth-context';
import { projectRoutes } from './projects/routes';
import { memberRoutes } from './members/routes';
import { roleRoutes } from './roles/routes';
import { inviteRoutes } from './invites/routes';
import { columnRoutes } from './modules/columns';
import { issueTypeRoutes } from './issue-types/routes';
import { labelRoutes } from './labels/routes';
import { aiAgentRoutes } from './modules/agents/core';
import { integrationRoutes } from './modules/agents/integrations';
import { agentSkillRoutes } from './modules/agents/skills';
import { agentToolRoutes } from './modules/agents/tools';
import { customFieldRoutes } from './modules/custom-fields';
import { issueRoutes } from './issues/routes';
import { initiativeRoutes } from './modules/initiatives';
import { cycleRoutes } from './modules/cycles';
import { attachmentRoutes } from './modules/attachments';
import { avatarRoutes } from './modules/avatars';
import { viewRoutes } from './views/routes';
import { shareRoutes } from './share/routes';
import { actionRoutes } from './modules/actions';
import { webhookRoutes } from './webhooks/routes';
import { githubSettingsRoutes } from './modules/github';
import { dashboardRoutes } from './modules/dashboards';
import { noteBoardRoutes } from './note-boards/routes';
import { analyticsRoutes } from './modules/analytics';
import { settingsRoutes } from './settings/routes';
import { godRoutes } from './god/routes';
import { agentScheduleRoutes } from './modules/agents/schedules';
import { notificationRoutes } from './notifications/routes';
import { notificationSettingsRoutes } from './notification-settings/routes';
import { notificationPreferenceRoutes } from './notification-preferences/routes';
import { userPreferenceRoutes } from './modules/user-preferences';
import { telegramRoutes } from './telegram/routes';
import { syncRoutes } from './sync/routes';

// The planner API: projects and their columns, issue types, labels, AI agents,
// custom fields, issues, attachments, saved views, and actions. Mounted on the
// main app in ./index.ts.
//
// Every route requires a better-auth session (the shared authContext plugin each
// feature uses); the only exception is the public raw attachment route. The web
// client sends the session cookie with `credentials: "include"`.
//
// Errors are normalized to a { error } JSON body: HttpError carries its own
// status; a Postgres unique_violation becomes 409; request-body validation
// failures become 400; anything else is a 500 with the error logged.
export const planner = new Elysia({ name: 'planner' })
  .use(authContext)
  .onError({ as: 'global' }, ({ code, error, set }) => {
    if (error instanceof HttpError) {
      set.status = error.status;
      return { error: error.message };
    }
    if (code === 'VALIDATION') {
      set.status = 400;
      // The validator's first message is enough for the UI; the full report is
      // large JSON that the client would just show verbatim.
      const first = (error as { all?: { summary?: string }[] }).all?.[0]?.summary;
      return { error: first ?? 'Invalid request body' };
    }
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'Not found' };
    }
    if (pgErrorCode(error) === '23505') {
      set.status = 409;
      return { error: 'A record with this name already exists.' };
    }
    console.error('[planner] unhandled error:', error);
    set.status = 500;
    return { error: error instanceof Error ? error.message : 'Internal server error' };
  })
  .use(projectRoutes)
  .use(memberRoutes)
  .use(roleRoutes)
  .use(inviteRoutes)
  .use(columnRoutes)
  .use(issueTypeRoutes)
  .use(labelRoutes)
  .use(aiAgentRoutes)
  .use(integrationRoutes)
  .use(agentSkillRoutes)
  .use(agentToolRoutes)
  .use(customFieldRoutes)
  .use(issueRoutes)
  .use(initiativeRoutes)
  .use(cycleRoutes)
  .use(attachmentRoutes)
  .use(avatarRoutes)
  .use(viewRoutes)
  .use(shareRoutes)
  .use(actionRoutes)
  .use(webhookRoutes)
  .use(githubSettingsRoutes)
  .use(agentScheduleRoutes)
  .use(dashboardRoutes)
  .use(noteBoardRoutes)
  .use(analyticsRoutes)
  .use(notificationRoutes)
  .use(notificationSettingsRoutes)
  .use(notificationPreferenceRoutes)
  .use(userPreferenceRoutes)
  .use(telegramRoutes)
  .use(syncRoutes)
  .use(settingsRoutes)
  .use(godRoutes);
