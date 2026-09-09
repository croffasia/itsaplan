import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  listInvites,
  createInvite,
  sendInviteEmail,
  deleteInvite,
} from '@/lib/api/endpoints/invites';
import {
  type MemberListParams,
  type MemberRole,
  listMembers,
  listMemberCandidates,
  addMember,
  removeMember,
  setMemberRole,
  setMemberDescription,
} from '@/lib/api/endpoints/members';
import { qk } from '@/services/queryKeys';

// One page of the project's members. The window runs on the server, so the page
// never holds every member of the project; the previous page stays on screen while
// the next one loads.
export function useMembersQuery(projectKey: string | null, params: MemberListParams) {
  return useQuery({
    queryKey: qk.memberPage(projectKey ?? '', params),
    queryFn: () => listMembers(projectKey!, params),
    enabled: projectKey != null,
    placeholderData: keepPreviousData,
  });
}

// The team members who are not in the project yet. Only fetched while the dialog
// that adds one is open.
export function useMemberCandidatesQuery(projectKey: string, enabled = true) {
  return useQuery({
    queryKey: qk.memberCandidates(projectKey),
    queryFn: () => listMemberCandidates(projectKey),
    enabled,
  });
}

// Puts a member of the project's team in the project. Someone outside the team is
// invited by email instead.
export function useAddMember(projectKey: string) {
  const t = useTranslations('members');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: MemberRole; roleId?: number | null }) =>
      addMember(projectKey, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(projectKey) });
      qc.invalidateQueries({ queryKey: qk.anyTeam });
      toast.success(t('added'));
    },
    // The add dialog shows why the person was refused under its picker, so opt out
    // of the global error toast.
    meta: { suppressErrorToast: true },
  });
}

export function useRemoveMember(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeMember(projectKey, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(projectKey) });
      qc.invalidateQueries({ queryKey: qk.anyTeam });
    },
  });
}

// Set a member's role. role 'owner' promotes to owner; role 'member' assigns a custom
// role by roleId (null resets to the default role).
export function useSetMemberRole(projectKey: string) {
  const t = useTranslations('members');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      role,
      roleId,
    }: {
      userId: string;
      role: MemberRole;
      roleId?: number | null;
    }) => setMemberRole(projectKey, userId, { role, roleId }),
    onSuccess: (_data, { role }) => {
      qc.invalidateQueries({ queryKey: qk.members(projectKey) });
      qc.invalidateQueries({ queryKey: qk.anyTeam });
      toast.success(t(role === 'owner' ? 'promoted' : 'roleUpdated'));
    },
  });
}

// Set what a member does in the project.
export function useSetMemberDescription(projectKey: string) {
  const t = useTranslations('members');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, description }: { userId: string; description: string }) =>
      setMemberDescription(projectKey, userId, description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(projectKey) });
      qc.invalidateQueries({ queryKey: qk.anyTeam });
      toast.success(t('descriptionUpdated'));
    },
  });
}

// Invites are owner-only on the API; pass enabled=false for a non-owner so the
// list query does not fire a request that would 403.
export function useInvitesQuery(projectKey: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.invites(projectKey ?? ''),
    queryFn: () => listInvites(projectKey!),
    enabled: projectKey != null && enabled,
  });
}

export function useCreateInvite(projectKey: string) {
  const t = useTranslations('members.invites');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: MemberRole; roleId?: number | null }) =>
      createInvite(projectKey, input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: qk.invites(projectKey) });
      if (result.emailQueued) toast.success(t('emailQueued'));
      else toast.info(t('emailUnavailable'));
    },
    // As with useAddMember: the add dialog owns the error UI.
    meta: { suppressErrorToast: true },
  });
}

export function useSendInviteEmail(projectKey: string) {
  const t = useTranslations('members.invites');
  return useMutation({
    mutationFn: (inviteId: number) => sendInviteEmail(projectKey, inviteId),
    onSuccess: (result) => {
      if (result.emailQueued) toast.success(t('emailQueued'));
      else toast.info(t('resendUnavailable'));
    },
  });
}

export function useDeleteInvite(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: number) => deleteInvite(projectKey, inviteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invites(projectKey) }),
  });
}
