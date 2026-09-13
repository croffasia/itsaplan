import type { CycleOption } from '@/lib/api/endpoints/cycles';
import type { BoardIssues } from '@/lib/api/endpoints/issues';
import { request } from '@/lib/api/core/client';
import type { Column } from '@/lib/api/endpoints/columns';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { IssueTemplate } from '@/lib/api/endpoints/issueTemplates';
import type { IssueType } from '@/lib/api/endpoints/issueTypes';
import type { Label, LabelGroup } from '@/lib/api/endpoints/labels';
import type { MemberRole } from '@/lib/api/endpoints/members';
import type { Permissions } from '@/lib/api/endpoints/roles';
import type { ProjectFeatures } from '@/lib/api/endpoints/settings';
import type { TeamRole } from '@/lib/api/endpoints/teams';

export interface Project {
  id: number;
  teamId: number;
  teamName: string;
  key: string;
  name: string;
  description: string;
  // Whether the team's MCP reach covers this project, and whether the team is
  // reachable over MCP at all. Both are set in the team's MCP section; a tool call
  // scoped to this project needs both.
  mcpEnabled: boolean;
  teamMcpEnabled: boolean;
  // The optional sections, toggled by an owner in Settings -> General. Read through
  // useProjectFeatures, which hides the navigation and the section itself.
  initiativesEnabled: boolean;
  dashboardsEnabled: boolean;
  documentsEnabled: boolean;
  notesEnabled: boolean;
  cyclesEnabled: boolean;
  subtasksEnabled: boolean;
  checklistsEnabled: boolean;
  issueStatsEnabled: boolean;
  // The sections this project may use at all. One missing here is not available to
  // the team: its flag above always reads false and the settings page does not offer
  // it. Everything is available on a self-hosted instance.
  availableFeatures: (keyof ProjectFeatures)[];
  // Which estimate kinds the issues carry, set in Settings -> Configuration. Read
  // through useProjectFeatures, which hides the estimate rows and their display
  // properties while a kind is off.
  pointsEstimateEnabled: boolean;
  timeEstimateEnabled: boolean;
  // Whether members log the time they spend on the issues, set in the same place.
  // Independent of the time estimate.
  timeLoggingEnabled: boolean;
  createdAt: string;
  // Latest work-item activity or comment, present on the project list response.
  lastActivityAt?: string | null;
  isFavorite?: boolean;
  isHidden?: boolean;
  // The caller's role in this project. Only present on the /projects list
  // response; absent on the create/copy responses.
  role?: MemberRole;
}

export interface Assignee {
  userId: string;
  name: string;
  email: string;
  // The handle they are mentioned by, @username. Null for a member who has none.
  username: string | null;
  image: string | null;
  kind: 'member' | 'agent';
  agentKind: 'external' | 'internal' | null;
  // The user an 'owner'-scoped agent works for: delegating it to anyone else queues a
  // run its runner never receives. Null for members and team-scoped agents.
  restrictedToUserId: string | null;
  // Whether this person may read issues and can therefore receive watcher
  // notifications without leaking work-item content.
  canReadWorkItems: boolean;
}

// The caller's own role in a project (owner/member). Returned with the project;
// the resolved permission matrix is a sibling `permissions` field. See
// usePermissions.
export interface ProjectViewer {
  role: MemberRole;
  // The caller's standing in the team that owns the project, null when they are not
  // a member of it. An owner or manager governs the project's settings alongside the
  // project's own owner; 'agent' is a bot user reading its own board, which governs
  // nothing.
  teamRole: TeamRole | 'agent' | null;
}

// The board scaffold, returned by getProject: everything the work-items UI needs
// except the issues themselves (those come from getBoardIssues).
export interface ProjectScaffold {
  project: Project;
  columns: Column[];
  issueTypes: IssueType[];
  labels: Label[];
  labelGroups: LabelGroup[];
  assignees: Assignee[];
  // Every custom field of the project (all type scopes); consumers filter by
  // issueTypeId locally.
  customFields: CustomField[];
  issueTemplates: IssueTemplate[];
  viewer: ProjectViewer;
  // The caller's resolved permission matrix (owners get every flag).
  permissions: Permissions;
}

// The scaffold composed with its issues and the project's unfinished cycles, as
// the Shell assembles it and passes it down. Downstream reads project.issues off
// this composite. `plannedCycles` is empty while the Cycles section is off and on a
// public share (whose bundle carries no cycle list).
export type ProjectDetail = ProjectScaffold & BoardIssues & { plannedCycles: CycleOption[] };

// The instance upload limits. Readable by any signed-in user, because the upload UI
// states them before a file is picked; only god mode can change them.
export interface ProjectDefaults {
  mcpEnabled: boolean;
}

export const listProjects = () => request<Project[]>('/projects');

export type ProjectPreferencePatch = { isFavorite?: boolean; isHidden?: boolean };

export const updateProjectPreferences = (projectKey: string, patch: ProjectPreferencePatch) =>
  request<{ isFavorite: boolean; isHidden: boolean }>(`/projects/${projectKey}/preferences`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const createProject = (input: {
  key: string;
  name: string;
  description?: string;
  preset?: string;
}) => request<Project>('/projects', { method: 'POST', body: JSON.stringify(input) });

// Update a project's name/description. The key is immutable, so it is not sent.
export const updateProject = (projectKey: string, patch: { name?: string; description?: string }) =>
  request<Project>(`/projects/${projectKey}`, { method: 'PATCH', body: JSON.stringify(patch) });

// The board scaffold (no issues). The issues come from getBoardIssues.
export const getProject = (projectKey: string, signal?: AbortSignal) =>
  request<ProjectScaffold>(`/projects/${encodeURIComponent(projectKey)}`, { signal });

// The board's issues and their relations.
export const getBoardIssues = (projectKey: string) =>
  request<BoardIssues>(`/projects/${projectKey}/issues/board`);
