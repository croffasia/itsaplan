import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type MemberRole } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useMembersQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.members(projectKey ?? ''),
    queryFn: () => api.listMembers(projectKey!),
    enabled: projectKey != null,
  });
}

export function useRemoveMember(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.removeMember(projectKey, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.members(projectKey) }),
  });
}

// Set a member's role (owner-only on the API). role 'owner' promotes to owner;
// role 'member' assigns a custom role by roleId (null resets to the default role).
export function useSetMemberRole(projectKey: string) {
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
    }) => api.setMemberRole(projectKey, userId, { role, roleId }),
    onSuccess: (_data, { role }) => {
      qc.invalidateQueries({ queryKey: qk.members(projectKey) });
      toast.success(role === 'owner' ? 'Member promoted to owner' : 'Member role updated');
    },
  });
}

// Set what a member does in the project (owner-only on the API).
export function useSetMemberDescription(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, description }: { userId: string; description: string }) =>
      api.setMemberDescription(projectKey, userId, description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(projectKey) });
      toast.success('Member description updated');
    },
  });
}

// Invites are owner-only on the API; pass enabled=false for a non-owner so the
// list query does not fire a request that would 403.
export function useInvitesQuery(projectKey: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.invites(projectKey ?? ''),
    queryFn: () => api.listInvites(projectKey!),
    enabled: projectKey != null && enabled,
  });
}

export function useCreateInvite(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: MemberRole; roleId?: number | null }) =>
      api.createInvite(projectKey, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invites(projectKey) }),
  });
}

export function useDeleteInvite(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: number) => api.deleteInvite(projectKey, inviteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invites(projectKey) }),
  });
}
