// Path builders for the planner routes. The project, the open view and the open
// settings section live in the URL, so these are the single source of truth —
// see the app/project/[projectKey] route tree.
import type { StartPage } from '@/lib/api';

export const projectPath = (key: string) => `/project/${encodeURIComponent(key)}`;

export const viewPath = (key: string, viewId: number | null) =>
  viewId != null ? `${projectPath(key)}/view/${viewId}` : projectPath(key);

export const dashboardsPath = (key: string) => `${projectPath(key)}/dashboard`;

export const dashboardPath = (key: string, dashboardId: number) =>
  `${dashboardsPath(key)}/${dashboardId}`;

export const settingsPath = (key: string, section: string) =>
  `${projectPath(key)}/settings/${section}`;

// The AI Team destinations: the chat and the sections listed next to it in the
// main sidebar (see AI_TEAM_SECTIONS).
export const aiTeamPath = (key: string, section: string) =>
  `${projectPath(key)}/ai-team/${section}`;

export const aiChatPath = (key: string) => aiTeamPath(key, 'chat');

export const inboxPath = (key: string) => `${projectPath(key)}/inbox`;

// The member's own notification preferences (which events, by which channel, their
// Telegram chat id). A main-nav Configuration destination, open to any member.
export const notificationsPath = (key: string) => `${projectPath(key)}/notifications`;

export const aiAgentsPath = (key: string) => `${projectPath(key)}/ai-agents`;

export const integrationsPath = (key: string) => `${projectPath(key)}/integrations`;

export const agentSkillsPath = (key: string) => `${projectPath(key)}/agent-skills`;

export const agentToolsPath = (key: string) => `${projectPath(key)}/agent-tools`;

export const mcpServerPath = (key: string) => `${projectPath(key)}/mcp`;

export const apiDocsPath = (key: string) => `${projectPath(key)}/api`;

export const membersPath = (key: string) => `${projectPath(key)}/members`;

export const rolesPath = (key: string) => `${projectPath(key)}/members/roles`;

// Issues are addressed in the URL by their project-scoped number (the "42" in
// "MKT-42"), not the internal database id: /project/MKT/issue/42.
export const issuePath = (key: string, sequenceNumber: number) =>
  `${projectPath(key)}/issue/${sequenceNumber}`;

export const initiativesPath = (key: string) => `${projectPath(key)}/initiatives`;

// The initiative detail tabs are routes of their own, so a reload reopens the tab
// the user was on. Overview is the tab at the initiative's own path.
export type InitiativeTab = 'overview' | 'issues';

export const initiativePath = (
  key: string,
  initiativeId: number,
  tab: InitiativeTab = 'overview',
) => {
  const base = `${initiativesPath(key)}/${initiativeId}`;
  return tab === 'overview' ? base : `${base}/${tab}`;
};

// Where the app root sends the user, from their start page preference. The section
// opens in the project they were last in (see app/page.tsx).
export const startPagePath = (key: string, startPage: StartPage) => {
  switch (startPage) {
    case 'inbox':
      return inboxPath(key);
    case 'dashboard':
      return dashboardsPath(key);
    case 'initiatives':
      return initiativesPath(key);
    case 'ai-chat':
      return aiChatPath(key);
    default:
      return projectPath(key);
  }
};

// The standalone Manage projects page (outside the project shell), reached from
// the project switcher. Lists every project the user belongs to and lets an owner
// delete one.
export const manageProjectsPath = () => '/account/projects';

// The invitee-facing link an owner shares. Points at this web app's public
// /invite/:token page, which reads the token and shows the accept screen.
export const inviteLink = (origin: string, token: string) => `${origin}/invite/${token}`;

// God mode: instance administration, outside the project shell (see GOD_SECTIONS).
export const godPath = (section: string) => `/god/${section}`;
