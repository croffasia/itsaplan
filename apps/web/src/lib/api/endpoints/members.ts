import { request } from '@/lib/api/core/client';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';

// Project membership: a user's access to a project and their role in it. A member of
// the team that owns the project is added straight away; everyone else joins through
// an invite.
export type MemberRole = 'owner' | 'member';

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  // The sign-in name. null for an AI agent's bot user, which never gets one.
  username: string | null;
  image: string | null;
  // The zone this member reads timestamps in, from their preferences.
  timezone: string;
  role: MemberRole;
  // The assigned custom role. null when the member uses the project's default
  // role; owners never use roles (both fields null).
  roleId: number | null;
  roleName: string | null;
  // What this member does in the project, set by an owner. Empty string when unset.
  description: string;
  // True when this member is an AI agent's bot user. It joins and leaves with its AI
  // Agent config, so this list does not revoke it; its role is set here like a
  // person's.
  isAgent: boolean;
  // 'scim' when a provisioned group granted this membership. The sync rewrites such
  // a row on every run, so the role and remove actions are refused for it.
  source: 'invite' | 'scim';
  createdAt: string;
}

// Which members a list asks for: everyone, the people, or the AI agents.
export type MemberKind = 'all' | 'human' | 'agent';

// How many members own the project is what a page window cannot answer, and the last
// owner's row is the one that may not be removed.
export type MemberPage = Page<MemberRow> & { ownerCount: number };

// The filters every member list takes, on top of the page window. The search runs on
// the server, so the page and the total agree.
export interface MemberListParams extends PageParams {
  search?: string;
  kind: MemberKind;
}

// The query string a member list takes: the page window, the kind filter and the
// search. Shared with the team member lists.
export function memberListQuery(params: MemberListParams): string {
  return pageQuery(params, { kind: params.kind, search: params.search });
}

// Someone who can be added to a project without an invite: a member of the team that
// owns it who is not in the project yet.
export interface MemberCandidate {
  userId: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  isAgent: boolean;
}

// Members: list who is on a project, add someone from its team, and revoke access
// (an owner removes anyone; a member removes only themselves — leaving the
// project).
// One page of the project's members.
export const listMembers = (projectKey: string, params: MemberListParams) =>
  request<MemberPage>(`/projects/${projectKey}/members${memberListQuery(params)}`);

export const listMemberCandidates = (projectKey: string) =>
  request<MemberCandidate[]>(`/projects/${projectKey}/members/candidates`);

export const addMember = (
  projectKey: string,
  input: { userId: string; role: MemberRole; roleId?: number | null },
) =>
  request<void>(`/projects/${projectKey}/members`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const removeMember = (projectKey: string, userId: string) =>
  request<void>(`/projects/${projectKey}/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });

// Set a member's role (owner-only). role 'owner' promotes to owner; role
// 'member' assigns a custom role via roleId (null resets to the default role).
// The last owner cannot be demoted — the API rejects it.
export const setMemberRole = (
  projectKey: string,
  userId: string,
  input: { role: MemberRole; roleId?: number | null },
) =>
  request<void>(`/projects/${projectKey}/members/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

// Set what a member does in the project (owner-only). Empty string clears it.
export const setMemberDescription = (projectKey: string, userId: string, description: string) =>
  request<void>(`/projects/${projectKey}/members/${encodeURIComponent(userId)}/description`, {
    method: 'PATCH',
    body: JSON.stringify({ description }),
  });
