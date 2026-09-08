import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Permissions,
  type RoleListParams,
  getPermissionCatalog,
  listTeamRoles,
  listTeamRoleOptions,
  getRoleUsage,
  createRole,
  updateRole,
  deleteRole,
} from '@/lib/api/endpoints/roles';
import { qk } from '@/services/queryKeys';

// The resources and actions of the permission matrix. Static for the app's
// lifetime, so it never goes stale.
export function usePermissionCatalogQuery() {
  return useQuery({
    queryKey: qk.permissionCatalog,
    queryFn: () => getPermissionCatalog(),
    staleTime: Infinity,
  });
}

// One page of the team's roles, for the section that manages them. Pass null where
// the caller has no use for the list, to skip the request.
export function useTeamRolesQuery(teamId: number | null, params: RoleListParams) {
  return useQuery({
    queryKey: qk.teamRoles(teamId ?? 0, params),
    queryFn: () => listTeamRoles(teamId!, params),
    enabled: teamId != null,
    placeholderData: keepPreviousData,
  });
}

// Every role of the team, with its matrix: what the role pickers assign from, what
// the delete dialog moves a role's members to, and what the clipboard export carries.
export function useTeamRoleOptionsQuery(teamId: number | null) {
  return useQuery({
    queryKey: qk.teamRoleOptions(teamId ?? 0),
    queryFn: () => listTeamRoleOptions(teamId!),
    enabled: teamId != null,
  });
}

// What a role is assigned to, read when the delete dialog opens: the counts decide
// whether the caller has to name a role to move them to.
export function useRoleUsageQuery(teamId: number, roleId: number) {
  return useQuery({
    queryKey: qk.roleUsage(teamId, roleId),
    queryFn: () => getRoleUsage(teamId, roleId),
  });
}

// A role belongs to the team, so a write to it changes what every project of that
// team offers and what its members, agents and pending invites resolve to.
function useRoleMutation<TInput, TResult>(
  teamId: number,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.anyTeamRoles(teamId) });
      // The team list carries how many roles the team has.
      qc.invalidateQueries({ queryKey: qk.teams });
      qc.invalidateQueries({ queryKey: qk.anyRoleUsage });
      qc.invalidateQueries({ queryKey: qk.anyMembers });
      qc.invalidateQueries({ queryKey: qk.anyAiAgents });
      qc.invalidateQueries({ queryKey: qk.anyInvites });
      qc.invalidateQueries({ queryKey: qk.anyTeamInvites });
    },
  });
}

export function useCreateRole(teamId: number) {
  return useRoleMutation(teamId, (input: { name: string; permissions: Permissions }) =>
    createRole(teamId, input),
  );
}

export function useUpdateRole(teamId: number) {
  return useRoleMutation(
    teamId,
    ({ roleId, patch }: { roleId: number; patch: { name?: string; permissions?: Permissions } }) =>
      updateRole(teamId, roleId, patch),
  );
}

// targetRoleId is where the members, agents and pending invites on the role are
// moved; the API refuses to delete a role in use without it.
export function useDeleteRole(teamId: number) {
  return useRoleMutation(
    teamId,
    ({ roleId, targetRoleId }: { roleId: number; targetRoleId?: number }) =>
      deleteRole(teamId, roleId, targetRoleId),
  );
}
