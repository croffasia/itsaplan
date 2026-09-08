import type { AnalyticsStats } from '@/lib/api/endpoints/analytics';
import type { Project } from '@/lib/api/endpoints/projects';
import { request } from '@/lib/api/core/client';
import type { Permissions } from '@/lib/api/endpoints/roles';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';
import {
  memberListQuery,
  type MemberListParams,
  type MemberRole,
} from '@/lib/api/endpoints/members';

// A team the caller belongs to. It owns projects and holds its own member list.
export interface Team {
  id: number;
  name: string;
  // Whether the team is reachable over MCP at all, set in its MCP section. Off closes
  // its own resources and every project it owns.
  mcpEnabled: boolean;
  // The caller's rank in the team. The API also answers an agent's own key, which reads
  // 'agent' there; an agent never opens this app, so a person's rank is what arrives.
  role: TeamRole;
  // How the caller's own membership came about. A provisioned one is the identity
  // provider's: the team cannot be left while it stands.
  source: 'invite' | 'scim';
  joinedAt: string;
  projectCount: number;
  memberCount: number;
  // How many of those members are owners: the last one cannot leave.
  ownerCount: number;
  // The roles the team's projects assign from, the integration credentials they run
  // on, the agents that work in them, and the skills and tools those agents use.
  // Counted here so the page shows them beside the section without opening it.
  roleCount: number;
  integrationCount: number;
  agentCount: number;
  skillCount: number;
  toolCount: number;
  createdAt: string;
}

export type TeamRole = 'owner' | 'manager' | 'member';

// One member of a team: a person, or the bot user of one of its agents. An agent's
// standing in the team is 'agent' and says nothing about what it may do — that is the
// role each of its project memberships carries.
export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: TeamRole | 'agent';
  // 'scim' when a provisioned group granted this membership. It ends at the identity
  // provider, so the list does not remove it.
  source: 'invite' | 'scim';
  agentId: number | null;
  username: string | null;
  joinedAt: string;
}

// A project the team owns. `isMember` is the caller's own access to it: a team
// member sees every project of the team, but only opens the ones they belong to.
export interface TeamProject {
  id: number;
  key: string;
  name: string;
  description: string;
  // Whether the team's MCP reach covers this project. Only counts while the team's
  // own switch is on.
  mcpEnabled: boolean;
  memberCount: number;
  owners: { userId: string; name: string; image: string | null }[];
  isMember: boolean;
  createdAt: string;
}

// What a team's project list asks for: the window, and a search over the key and the
// name. The search runs on the server, so the page and the total agree.
export interface TeamProjectListParams extends PageParams {
  search?: string;
}

// A project as the pickers read it, plus the MCP reach the team's switches set.
export interface TeamProjectOption {
  id: number;
  key: string;
  name: string;
  mcpEnabled: boolean;
}

export interface TeamDetail extends Team {
  // What the caller may do with the resources the team holds for all its projects.
  // Owners and managers get the full matrix; a member gets the permissions of their
  // project roles in the team, merged.
  permissions: Permissions;
  // The people who run the team, owners first.
  leads: TeamLead[];
}

export interface TeamLead {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: 'owner' | 'manager';
}

// One project the team owns, as its row in the team panel opens it: how its issues
// stand, and where the reader stands in it. Its members are a page of their own.
export interface TeamProjectDetail {
  lastActivityAt: string | null;
  stats: AnalyticsStats;
  // The reader's own membership in the project, null when they only run the team.
  // A provisioned one ends at the identity provider, so it cannot be left here.
  viewer: { role: MemberRole; source: 'invite' | 'scim'; permissions: Permissions } | null;
}

// One member of a project the team owns. The access their membership resolves to is
// the matrix of the role they hold, which the reader already has from the team's
// roles.
export interface TeamProjectMember {
  userId: string;
  name: string;
  email: string;
  // The handle they are mentioned by, @username. An agent's bot user carries the
  // agent's handle.
  username: string | null;
  image: string | null;
  isAgent: boolean;
  role: MemberRole;
  roleId: number | null;
  roleName: string | null;
  // What the member does in the project, and which path their membership came from —
  // both needed by the panel, which edits the membership from there.
  description: string;
  source: 'invite' | 'scim';
  timezone: string;
  joinedAt: string;
}

// A team's MCP settings: the switch, and which of its projects the reach covers.
export interface TeamMcpSettings {
  enabled: boolean;
  projects: { projectId: number; enabled: boolean }[];
}

// Parts of a source project the copy can carry over, one key per project settings
// section. Passed to copyTeamProject as an include map; omitted keys are not
// copied. The API force-enables dependencies (a view needs its
// states/types/labels/fields).
export type CopyProjectIncludeKey =
  | 'states'
  | 'issueTypes'
  | 'labels'
  | 'customFields'
  | 'views'
  | 'dashboards'
  | 'documents'
  | 'actions'
  | 'configuration'
  | 'webhooks'
  | 'agents'
  | 'schedules';

export const listTeams = () => request<Team[]>('/teams');

export const getTeam = (teamId: number) => request<TeamDetail>(`/teams/${teamId}`);

// One page of the team's members. `search` matches the name, the address or the
// handle.
export const listTeamMembers = (teamId: number, params: MemberListParams) =>
  request<Page<TeamMember>>(`/teams/${teamId}/members${memberListQuery(params)}`);

// One page of the projects the team owns. `search` matches the key or the name.
export const listTeamProjects = (teamId: number, params: TeamProjectListParams) =>
  request<Page<TeamProject>>(
    `/teams/${teamId}/projects${pageQuery(params, { search: params.search })}`,
  );

// Every project the reader has in the team, for the agent's project picker and the
// MCP switches.
export const listTeamProjectOptions = (teamId: number) =>
  request<TeamProjectOption[]>(`/teams/${teamId}/projects/options`);

export const getTeamProject = (teamId: number, projectId: number) =>
  request<TeamProjectDetail>(`/teams/${teamId}/projects/${projectId}`);

// One page of a project's members. `search` matches the name, the address or the
// handle.
export const listTeamProjectMembers = (
  teamId: number,
  projectId: number,
  params: MemberListParams,
) =>
  request<Page<TeamProjectMember>>(
    `/teams/${teamId}/projects/${projectId}/members${memberListQuery(params)}`,
  );

export const createTeam = (input: { name: string }) =>
  request<Team>('/teams', { method: 'POST', body: JSON.stringify(input) });

export const renameTeam = (teamId: number, input: { name: string }) =>
  request<Team>(`/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify(input) });

export const leaveTeam = (teamId: number) =>
  request<void>(`/teams/${teamId}/leave`, { method: 'POST' });

export const setTeamMemberRole = (teamId: number, userId: string, role: TeamRole) =>
  request<void>(`/teams/${teamId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });

export const removeTeamMember = (teamId: number, userId: string) =>
  request<void>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' });

export const updateTeamMcp = (
  teamId: number,
  patch: { enabled?: boolean; projects?: { projectId: number; enabled: boolean }[] },
) =>
  request<TeamMcpSettings>(`/teams/${teamId}/mcp`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

// The projects a team owns: created, copied, and deleted by the team's own ranks
// (owner/manager create and copy, owner deletes) rather than by project membership.
export const createTeamProject = (
  teamId: number,
  input: { key: string; name: string; description?: string; preset?: string },
) =>
  request<Project>(`/teams/${teamId}/projects`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const copyTeamProject = (
  teamId: number,
  projectId: number,
  input: {
    key: string;
    name: string;
    description?: string;
    include?: Partial<Record<CopyProjectIncludeKey, boolean>>;
  },
) =>
  request<Project>(`/teams/${teamId}/projects/${projectId}/copy`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateTeamProject = (
  teamId: number,
  projectId: number,
  patch: { name?: string; description?: string },
) =>
  request<Project>(`/teams/${teamId}/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteTeamProject = (teamId: number, projectId: number) =>
  request<void>(`/teams/${teamId}/projects/${projectId}`, { method: 'DELETE' });
