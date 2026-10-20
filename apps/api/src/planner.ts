import { Elysia } from 'elysia';
import { errorAnswer } from './shared/lib';
import { authContext } from './shared/auth-context';
import { projectRoutes } from './modules/projects';
import { teamRoutes } from './modules/teams';
import { workspaceRoutes } from './modules/workspaces';
import { memberRoutes } from './modules/members';
import { roleRoutes } from './modules/roles';
import { inviteRoutes } from './modules/invites';
import { columnRoutes } from './modules/columns';
import { issueTypeRoutes } from './modules/issue-types';
import { labelRoutes } from './modules/labels';
import { aiAgentRoutes } from './modules/agents/core';
import { integrationRoutes } from './modules/agents/integrations';
import { agentSkillRoutes } from './modules/agents/skills';
import { agentToolRoutes } from './modules/agents/tools';
import { customFieldRoutes } from './modules/custom-fields';
import { issueTemplateRoutes } from './modules/issue-templates';
import { issueRoutes } from './modules/issues';
import { initiativeRoutes } from './modules/initiatives';
import { cycleRoutes } from './modules/cycles';
import { attachmentRoutes } from './modules/attachments';
import { chatAttachmentRoutes } from './modules/chat-attachments';
import { importRoutes } from './modules/imports';
import { importExportRoutes } from './modules/import-export';
import { avatarRoutes } from './modules/avatars';
import { viewRoutes } from './modules/views';
import { shareRoutes } from './modules/share';
import { actionRoutes } from './modules/actions';
import { webhookRoutes } from './modules/webhooks';
import { gitSettingsRoutes } from './modules/git';
import { dashboardRoutes } from './modules/dashboards';
import { noteBoardRoutes } from './modules/note-boards';
import { documentRoutes } from './modules/documents';
import { analyticsRoutes } from './modules/analytics';
import { chartRoutes } from './modules/charts';
import { settingsRoutes } from './modules/settings';
import { godRoutes } from './modules/god';
import { agentScheduleRoutes } from './modules/agents/schedules';
import { modelPriceRoutes } from './modules/agents/prices';
import { agentRunnerRoutes } from './modules/agents/runner';
import { agentChatRoutes } from './modules/agents/chat';
import { agentInvocationRoutes } from './modules/agents/invocation';
import { notificationRoutes } from './modules/notifications';
import { notificationSettingsRoutes } from './modules/notification-settings';
import { notificationPreferenceRoutes } from './modules/notification-preferences';
import { userPreferenceRoutes } from './modules/user-preferences';
import { connectedAppRoutes } from './modules/connected-apps';
import { telegramRoutes } from './modules/telegram';
import { syncRoutes } from './modules/sync';
import { linkPreviewRoutes } from './modules/link-previews';

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
    const answer = errorAnswer(code, error);
    if (answer.status === 500) console.error('[planner] unhandled error:', error);
    set.status = answer.status;
    return answer.body;
  })
  .use(projectRoutes)
  .use(teamRoutes)
  .use(workspaceRoutes)
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
  .use(issueTemplateRoutes)
  .use(issueRoutes)
  .use(initiativeRoutes)
  .use(cycleRoutes)
  .use(attachmentRoutes)
  .use(chatAttachmentRoutes)
  .use(importRoutes)
  .use(importExportRoutes)
  .use(avatarRoutes)
  .use(viewRoutes)
  .use(shareRoutes)
  .use(actionRoutes)
  .use(webhookRoutes)
  .use(gitSettingsRoutes)
  .use(agentScheduleRoutes)
  .use(modelPriceRoutes)
  .use(agentRunnerRoutes)
  .use(agentChatRoutes)
  .use(agentInvocationRoutes)
  .use(dashboardRoutes)
  .use(noteBoardRoutes)
  .use(documentRoutes)
  .use(analyticsRoutes)
  .use(chartRoutes)
  .use(notificationRoutes)
  .use(notificationSettingsRoutes)
  .use(notificationPreferenceRoutes)
  .use(userPreferenceRoutes)
  .use(connectedAppRoutes)
  .use(telegramRoutes)
  .use(syncRoutes)
  .use(linkPreviewRoutes)
  .use(settingsRoutes)
  .use(godRoutes);
