import { HttpError } from './lib';
import {
  getProjectById,
  getProjectByRef,
  projectFeatures,
  type ProjectRow,
} from '#modules/projects/service';
import { featureLabel, type ProjectFeature } from './features';
import { getMembership, getMemberContext, getTeamPermissions } from '#modules/members/service';
import { getTeamMembership, runsTeam, type TeamStanding } from '#modules/teams/service';
import { hasPermission, type PermissionAction, type PermissionResource } from './permissions';

// The authenticated user carried on the request context. Populated by the
// session guard in planner.ts from the better-auth session. Access checks only
// need the id; role is the global better-auth role ("god" | "user") and is not
// used for project access (access is strictly by project membership).
export interface AuthUser {
  id: string;
  email?: string | null;
  role?: string | null;
}

// Asserts a session is present, returning the user. Handlers under the planner
// run behind the session guard, but the context type still allows an absent
// user (the public raw-attachment route has none), so this narrows it and
// throws 401 when called without a session.
export function requireUser(user: AuthUser | undefined | null): AuthUser {
  if (!user) throw new HttpError(401, 'Authentication required');
  return user;
}

// Asserts the session belongs to the instance owner ("god"), the role the first
// registered user gets. It gates instance-wide administration (god mode) only —
// project access stays strictly by membership, so this never bypasses a project
// permission check.
export function requireGod(user: AuthUser | undefined | null): AuthUser {
  const current = requireUser(user);
  if (current.role !== 'god') throw new HttpError(403, 'Instance administration is owner-only');
  return current;
}

// Resolves the :projectKey path param (see getProjectByRef), throwing 404 for an
// unknown project.
async function requireProject(projectKey: string, userId: string): Promise<ProjectRow> {
  const project = await getProjectByRef(projectKey, userId);
  if (!project) throw new HttpError(404, `Project '${projectKey}' not found`);
  return project;
}

// Resolves the :projectKey path param to a project the user may access. Throws
// 404 for an unknown project and 403 when the user is not a member. Wrapped by
// the projectMember and projectOwner guards.
export async function requireProjectAccess(
  projectKey: string,
  user: AuthUser | undefined | null,
): Promise<ProjectRow> {
  const current = requireUser(user);
  const project = await requireProject(projectKey, current.id);
  const role = await getMembership(project.id, current.id);
  if (!role) throw new HttpError(403, 'You do not have access to this project');
  return project;
}

// Resolves the :projectKey path param to a project and asserts the user is an
// owner, in a single membership lookup. Wrapped by the projectOwner guard, used
// for role and member management. Throws 404 for an unknown project, and 403 for
// a non-member or a member who is not an owner.
export async function requireProjectOwner(
  projectKey: string,
  user: AuthUser | undefined | null,
): Promise<ProjectRow> {
  const current = requireUser(user);
  const project = await requireProject(projectKey, current.id);
  const role = await getMembership(project.id, current.id);
  if (!role) throw new HttpError(403, 'You do not have access to this project');
  if (role !== 'owner') throw new HttpError(403, 'Only a project owner can do this');
  return project;
}

// Resolves the :projectKey path param to a project the caller administers: an owner
// of the project, or an owner or manager of the team that owns it. That is the
// standing the project's own settings need — MCP access and the optional sections —
// which the role matrix does not express. Wrapped by the projectAdmin guard. Throws
// 404 for an unknown project and 403 for anyone else.
export async function requireProjectAdmin(
  projectKey: string,
  user: AuthUser | undefined | null,
): Promise<ProjectRow> {
  const current = requireUser(user);
  const project = await requireProject(projectKey, current.id);
  await assertProjectAdmin(project, current);
  return project;
}

// The same rule for a handler that already holds the project row: an owner of the
// project, or an owner or manager of the team that owns it. Granting project
// ownership asks for it — an owner bypasses the role matrix, so the member
// permission that fills the list must not also be able to hand that out.
export async function assertProjectAdmin(
  project: ProjectRow,
  user: AuthUser | undefined | null,
): Promise<void> {
  const current = requireUser(user);
  if ((await getMembership(project.id, current.id)) === 'owner') return;
  if (runsTeam(await getTeamMembership(project.teamId, current.id))) return;
  throw new HttpError(403, 'Only a project owner or a team owner or manager can do this');
}

// Resolves the :projectKey path param to a project the caller's team runs: an owner
// or manager of the team that owns it. A copy carries the project's configuration —
// its webhooks and their signing secrets among it — into a project of the caller's
// own, so it follows their rank in the team and no project role grants it. Wrapped
// by the teamRunsProject guard. Throws 404 for an unknown project and 403 for
// anyone else.
export async function requireTeamRunsProject(
  projectKey: string,
  user: AuthUser | undefined | null,
): Promise<ProjectRow> {
  const current = requireUser(user);
  const project = await requireProject(projectKey, current.id);
  if (!runsTeam(await getTeamMembership(project.teamId, current.id)))
    throw new HttpError(403, 'Only a team owner or manager can do this');
  return project;
}

// Resolves the :projectKey path param to a project whose member list the caller may
// act on: a member the role matrix allows, or an owner or manager of the team that
// owns it. The team runs its projects, so it fills them from its own member list and
// invites into them without belonging to them. Wrapped by the memberAdmin guard.
export async function requireMemberAdmin(
  projectKey: string,
  user: AuthUser | undefined | null,
  resource: PermissionResource,
  action: PermissionAction,
): Promise<ProjectRow> {
  const current = requireUser(user);
  const project = await requireProject(projectKey, current.id);
  const standing = await getTeamMembership(project.teamId, current.id);
  if (runsTeam(standing)) return project;
  await assertPermission(project.id, current, resource, action);
  return project;
}

// Resolves the :projectKey path param for a route acting on one member's own row.
// A member acts on themselves — leaving the project, saying what they do in it —
// without any member permission; anyone else needs what requireMemberAdmin asks
// for. Wrapped by the memberSelfOrAdmin guard.
export async function requireSelfOrMemberAdmin(
  projectKey: string,
  targetUserId: string,
  user: AuthUser | undefined | null,
  resource: PermissionResource,
  action: PermissionAction,
): Promise<ProjectRow> {
  const current = requireUser(user);
  if (targetUserId === current.id) return requireProjectAccess(projectKey, current);
  return requireMemberAdmin(projectKey, current, resource, action);
}

// Denies an MCP tool call against a project out of its team's MCP reach: the team
// switched MCP off, or the project is not among the ones it covers. A no-op for
// normal web/API requests (isMcp false), so the toggles only gate the MCP surface,
// not the UI. Called by the guards after the project is resolved.
export function assertMcpEnabled(project: ProjectRow, isMcp: boolean): void {
  if (!isMcp) return;
  if (!project.teamMcpEnabled) throw new HttpError(403, 'MCP is disabled for this team');
  if (!project.mcpEnabled) throw new HttpError(403, 'MCP is disabled for this project');
}

// Denies a call against a section the project has turned off, or that the team may
// not use at all (the DTO reads a blocked section as off, which is what this reads).
// Turning a section off hides it and closes its routes: what it already holds stays
// in the database and comes back with it.
export function assertFeatureEnabled(project: ProjectRow, feature: ProjectFeature): void {
  if (projectFeatures(project)[feature]) return;
  throw new HttpError(403, `${featureLabel(feature)} are turned off for this project`);
}

// The same check for a caller that resolved only the project's id.
export async function assertProjectFeature(
  projectId: number,
  feature: ProjectFeature,
): Promise<void> {
  const project = await getProjectById(projectId);
  if (project) assertFeatureEnabled(project, feature);
}

// Formats a resource key for an error message: "custom_fields" -> "custom fields".
function resourceLabel(resource: PermissionResource): string {
  return resource.replace(/_/g, ' ');
}

// Asserts the user is a member of the project and their role grants the given
// action on the given resource. Owners bypass the matrix (always allowed).
// Throws 403 for a non-member or a member whose role lacks the permission. The
// underlying permission check behind the permission guard and the feature-local
// entity guards.
export async function assertPermission(
  projectId: number,
  user: AuthUser | undefined | null,
  resource: PermissionResource,
  action: PermissionAction,
): Promise<void> {
  const current = requireUser(user);
  const ctx = await getMemberContext(projectId, current.id);
  if (!ctx) throw new HttpError(403, 'You do not have access to this project');
  if (ctx.role === 'owner') return;
  if (!hasPermission(ctx.permissions, resource, action)) {
    throw new HttpError(403, `You do not have permission to ${action} ${resourceLabel(resource)}`);
  }
}

// Asserts the user is an owner of the project, addressed by id — the parallel of
// assertPermission for a rule the role matrix cannot express, such as touching an
// entry another member owns.
export async function assertProjectOwner(
  projectId: number,
  user: AuthUser | undefined | null,
): Promise<void> {
  const current = requireUser(user);
  const role = await getMembership(projectId, current.id);
  if (!role) throw new HttpError(403, 'You do not have access to this project');
  if (role !== 'owner') throw new HttpError(403, 'Only a project owner can do this');
}

// Whether the user may perform the action, without throwing. For field-level
// shaping inside a handler that is already access-gated (e.g. redacting a
// secret for callers who may read but not edit).
export async function checkPermission(
  projectId: number,
  user: AuthUser | undefined | null,
  resource: PermissionResource,
  action: PermissionAction,
): Promise<boolean> {
  if (!user) return false;
  const ctx = await getMemberContext(projectId, user.id);
  if (!ctx) return false;
  return ctx.role === 'owner' || hasPermission(ctx.permissions, resource, action);
}

// Resolves the :projectKey path param to a project and asserts the given
// permission in one step. Wrapped by the permission guard. Throws 404 for an
// unknown project and 403 when the permission is missing.
export async function requireProjectPermission(
  projectKey: string,
  user: AuthUser | undefined | null,
  resource: PermissionResource,
  action: PermissionAction,
): Promise<ProjectRow> {
  const current = requireUser(user);
  const project = await requireProject(projectKey, current.id);
  await assertPermission(project.id, current, resource, action);
  return project;
}

// The caller's standing in the team a :teamId route addresses.
export interface TeamMembership {
  teamId: number;
  role: TeamStanding;
  userId: string;
}

// Resolves the :teamId path param to the caller's membership in it. 404 for an
// unknown team and for one the caller is not a member of: a team the caller cannot
// see should not be distinguishable from one that does not exist. Wrapped by the
// team guards.
export async function requireTeamMembership(
  teamId: number,
  user: AuthUser | undefined | null,
): Promise<TeamMembership> {
  const current = requireUser(user);
  const role = await getTeamMembership(teamId, current.id);
  if (!role) throw new HttpError(404, 'Team not found');
  return { teamId, role, userId: current.id };
}

// Asserts the caller may perform the action on a resource the team owns and every
// project of it shares. Owners and managers always may — they run the team. So does
// an owner of one of its projects, whose project membership carries the full matrix.
// Anyone else — a member, and an agent, whose standing in the team grants nothing on
// its own — may when a project role of theirs in the team grants it. Wrapped by the
// teamPermission guard.
export async function requireTeamPermission(
  teamId: number,
  user: AuthUser | undefined | null,
  resource: PermissionResource,
  action: PermissionAction,
): Promise<TeamMembership> {
  const membership = await requireTeamMembership(teamId, user);
  if (runsTeam(membership.role)) return membership;
  const permissions = await getTeamPermissions(teamId, membership.userId);
  if (!hasPermission(permissions, resource, action)) {
    throw new HttpError(403, `You do not have permission to ${action} ${resourceLabel(resource)}`);
  }
  return membership;
}
