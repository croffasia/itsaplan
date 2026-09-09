import { request } from '@/lib/api/core/client';
import type { MemberRole } from '@/lib/api/endpoints/members';

export type InviteStatus = 'pending' | 'accepted' | 'rejected';

// The rank an invite puts its invitee on in the team. Only a team owner sends one
// that grants 'owner' or 'manager'.
export type InviteTeamRole = 'owner' | 'manager' | 'member';

// An invite as shown to whoever manages a team's or a project's invites: carries the
// token so they can share the link, and who sent it.
export interface InviteRow {
  id: number;
  token: string;
  email: string;
  teamRole: InviteTeamRole;
  // The project the invitee joins along with the team, or null for an invite into
  // the team alone.
  projectKey: string | null;
  projectName: string | null;
  // Their role in that project. null when the invite names no project.
  role: MemberRole | null;
  // The custom role the invitee joins the project on. null falls back to the team's
  // default role; roleName resolves it for display. A project owner has both null.
  roleId: number | null;
  roleName: string | null;
  status: InviteStatus;
  createdAt: string;
  respondedAt: string | null;
  invitedByName: string | null;
  invitedByEmail: string | null;
}

export interface InviteCreateResult extends InviteRow {
  emailQueued: boolean;
}

export interface InviteEmailResult {
  emailQueued: boolean;
}

// An invite as shown to the invitee opening the link: enough team and project
// context to decide, never the internal ids.
export interface InviteView {
  token: string;
  teamName: string;
  projectKey: string | null;
  projectName: string | null;
  email: string;
  teamRole: InviteTeamRole;
  role: MemberRole | null;
  roleId: number | null;
  roleName: string | null;
  status: InviteStatus;
  createdAt: string;
  // Whether the invited email already has an account, so the accept screen can
  // open in sign-in mode instead of registration.
  hasAccount: boolean;
}

// Where an invitee landed once the invite was accepted.
export interface AcceptedInvite {
  teamName: string;
  projectKey: string | null;
  projectName: string | null;
  role: MemberRole | null;
}

// Invites — the managing side: create, list, email, and revoke the invite links of
// a project or of a team. A project invite joins the team as well; a team invite
// names no project.
export const listInvites = (projectKey: string) =>
  request<InviteRow[]>(`/projects/${projectKey}/invites`);

export const createInvite = (
  projectKey: string,
  input: { email: string; role: MemberRole; roleId?: number | null },
) =>
  request<InviteCreateResult>(`/projects/${projectKey}/invites`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const sendInviteEmail = (projectKey: string, inviteId: number) =>
  request<InviteEmailResult>(`/projects/${projectKey}/invites/${inviteId}/email`, {
    method: 'POST',
  });

export const deleteInvite = (projectKey: string, inviteId: number) =>
  request<void>(`/projects/${projectKey}/invites/${inviteId}`, { method: 'DELETE' });

export const listTeamInvites = (teamId: number) => request<InviteRow[]>(`/teams/${teamId}/invites`);

export const createTeamInvite = (teamId: number, input: { email: string; role: InviteTeamRole }) =>
  request<InviteRow>(`/teams/${teamId}/invites`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const deleteTeamInvite = (teamId: number, inviteId: number) =>
  request<void>(`/teams/${teamId}/invites/${inviteId}`, { method: 'DELETE' });

// Invites — invitee side: open a link by token, then accept or reject it. The
// session email must match the invite. Accept returns where to go next.
export const getInvite = (token: string) =>
  request<InviteView>(`/invites/${encodeURIComponent(token)}`);

export const acceptInvite = (token: string) =>
  request<AcceptedInvite>(`/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' });

export const rejectInvite = (token: string) =>
  request<void>(`/invites/${encodeURIComponent(token)}/reject`, { method: 'POST' });
