// Path builders for the planner routes. The project, the open view and the open
// settings section live in the URL, so these are the single source of truth —
// see the app/[teamRef] route tree.
//
// A project is addressed by its ref, "<teamRef>.<key>" (Project.ref), which is also
// what the API takes wherever a route names {projectKey}. The team's slug starts with
// a letter and carries no dot, so the first dot splits the two.
import type { StartPage } from '@/lib/api/endpoints/userPreferences';

export function splitProjectRef(ref: string): { teamRef: string; key: string } {
  const dot = ref.indexOf('.');
  return { teamRef: ref.slice(0, dot), key: ref.slice(dot + 1) };
}

export const projectRefOf = (teamRef: string, key: string) => `${teamRef}.${key}`;

export const projectPath = (ref: string) => {
  const { teamRef, key } = splitProjectRef(ref);
  return `/${encodeURIComponent(teamRef)}/${encodeURIComponent(key)}`;
};

export const viewPath = (ref: string, viewId: number | null) =>
  viewId != null ? `${projectPath(ref)}/view/${viewId}` : projectPath(ref);

export const dashboardsPath = (ref: string) => `${projectPath(ref)}/dashboards`;

// Public read-only share pages (no auth). The token is the unguessable share key.
export const shareIssuePath = (token: string) => `/share/issue/${token}`;
export const shareViewPath = (token: string) => `/share/view/${token}`;

// The absolute share URL to copy, built from the current origin at call time.
export const shareUrl = (path: string) =>
  typeof window === 'undefined' ? path : `${window.location.origin}${path}`;

export const dashboardPath = (ref: string, dashboardId: number) =>
  `${dashboardsPath(ref)}/${dashboardId}`;

export const notesPath = (ref: string) => `${projectPath(ref)}/notes`;

export const notePath = (ref: string, boardId: number) => `${notesPath(ref)}/${boardId}`;

export const documentsPath = (ref: string) => `${projectPath(ref)}/docs`;

export const documentPath = (ref: string, documentId: number) =>
  `${documentsPath(ref)}/${documentId}`;

export const settingsPath = (ref: string, section: string) =>
  `${projectPath(ref)}/settings/${section}`;

// The AI Team destinations listed in the main sidebar (see AI_TEAM_SECTIONS).
export const aiTeamPath = (ref: string, section: string) => `${projectPath(ref)}/agents/${section}`;

export const inboxPath = (ref: string) => `${projectPath(ref)}/inbox`;

// The member's own notification preferences (which events, by which channel, their
// Telegram chat id). A main-nav Configuration destination, open to any member.
export const notificationsPath = (ref: string) => `${projectPath(ref)}/notifications`;

export const aiAgentsPath = (ref: string) => `${projectPath(ref)}/agents`;

export const mcpServerPath = (ref: string) => `${projectPath(ref)}/mcp`;

export const apiDocsPath = (ref: string) => `${projectPath(ref)}/api`;

export const membersPath = (ref: string) => `${projectPath(ref)}/members`;

// An issue is addressed by its identifier under its team, not under its project:
// /acme/issue/MKT-42.
export const issuePath = (ref: string, sequenceNumber: number) => {
  const { teamRef, key } = splitProjectRef(ref);
  return `/${encodeURIComponent(teamRef)}/issue/${encodeURIComponent(key)}-${sequenceNumber}`;
};

// "MKT-42" -> { key: 'MKT', sequenceNumber: 42 }, or null for anything else.
export function parseIssueIdentifier(
  identifier: string,
): { key: string; sequenceNumber: number } | null {
  const match = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/.exec(identifier);
  return match ? { key: match[1], sequenceNumber: Number(match[2]) } : null;
}

export const initiativesPath = (ref: string) => `${projectPath(ref)}/initiatives`;

// Every status tab of the initiatives list is a route of its own, "All" included,
// so a reload or a shared link reopens the tab the user was on. The list path
// itself holds no tab: it redirects to the first tab with initiatives in it (see
// InitiativesRedirect). The page and the sorting stay in the query string.
const INITIATIVES_TABS = ['all', 'proposed', 'planned', 'active', 'completed'] as const;

export type InitiativesTab = (typeof INITIATIVES_TABS)[number];

export const isInitiativesTab = (value: string): value is InitiativesTab =>
  (INITIATIVES_TABS as readonly string[]).includes(value);

export const initiativesTabPath = (ref: string, tab: InitiativesTab) =>
  `${initiativesPath(ref)}/${tab}`;

// The initiative detail tabs are routes of their own too. A list tab is a word and an
// initiative is a number, so both sit directly under /initiatives.
export type InitiativeTab = 'overview' | 'progress' | 'issues';

export const initiativePath = (
  ref: string,
  initiativeId: number,
  tab: InitiativeTab = 'overview',
) => {
  const base = `${initiativesPath(ref)}/${initiativeId}`;
  return tab === 'overview' ? base : `${base}/${tab}`;
};

export const cyclesPath = (ref: string) => `${projectPath(ref)}/cycles`;

// Each layout of the cycles list is a route of its own, so a reload or a shared
// link reopens the one the user was on. The list path itself holds no layout: it
// redirects to the one remembered for the project (see CyclesRedirect).
const CYCLES_VIEWS = ['table', 'timeline'] as const;

export type CyclesView = (typeof CYCLES_VIEWS)[number];

export const isCyclesView = (value: string): value is CyclesView =>
  (CYCLES_VIEWS as readonly string[]).includes(value);

export const cyclesViewPath = (ref: string, view: CyclesView) => `${cyclesPath(ref)}/${view}`;

// A layout is a word and a cycle is a number, so both sit directly under /cycles.
export const cyclePath = (ref: string, cycleId: number) => `${cyclesPath(ref)}/${cycleId}`;

// Where the app root sends the user, from their start page preference. The section
// opens in the project they were last in (see app/page.tsx).
export const startPagePath = (ref: string, startPage: StartPage) => {
  switch (startPage) {
    case 'inbox':
      return inboxPath(ref);
    case 'dashboard':
      return dashboardsPath(ref);
    case 'initiatives':
      return initiativesPath(ref);
    default:
      return projectPath(ref);
  }
};

// The standalone Manage teams page, reached from the project switcher. With no team
// in the URL it opens the first team's settings.
export const manageTeamsPath = () => '/account/teams';

// Every section of a team is a route of its own, so each loads only what it shows.
// The team itself is the index of the team, so it carries no section segment.
export type TeamSection =
  | 'info'
  | 'projects'
  | 'members'
  | 'roles'
  | 'integrations'
  | 'mcp'
  | 'ai-agents'
  | 'agent-skills'
  | 'agent-tools'
  | 'notifications';

// A team's settings, under the team's ref (Team.ref): /acme/settings.
export const teamPath = (teamRef: string) => `/${encodeURIComponent(teamRef)}/settings`;

export const teamSectionPath = (teamRef: string, section: TeamSection) =>
  section === 'info' ? teamPath(teamRef) : `${teamPath(teamRef)}/${section}`;

// The invitee-facing link an owner shares. Points at this web app's public
// /invite/:token page, which reads the token and shows the accept screen.
export const inviteLink = (origin: string, token: string) => `${origin}/invite/${token}`;

// God mode: instance administration, outside the project shell (see GOD_SECTIONS).
export const godPath = (section: string) => `/god/${section}`;
