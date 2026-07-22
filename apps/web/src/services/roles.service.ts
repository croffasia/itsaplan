import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Permissions } from '@/lib/api';
import { qk } from '@/services/queryKeys';

// The resources and actions of the permission matrix. Static for the app's
// lifetime, so it never goes stale.
export function usePermissionCatalogQuery() {
  return useQuery({
    queryKey: qk.permissionCatalog,
    queryFn: () => api.getPermissionCatalog(),
    staleTime: Infinity,
  });
}

// Roles are listable by any member, but only owners have a use for them here.
// Pass enabled=false for a non-owner to skip the request.
export function useRolesQuery(projectKey: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.roles(projectKey ?? ''),
    queryFn: () => api.listRoles(projectKey!),
    enabled: projectKey != null && enabled,
  });
}

export function useCreateRole(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; permissions: Permissions }) =>
      api.createRole(projectKey, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.roles(projectKey) }),
  });
}

export function useUpdateRole(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      patch,
    }: {
      roleId: number;
      patch: { name?: string; permissions?: Permissions };
    }) => api.updateRole(projectKey, roleId, patch),
    // A rename changes the role name shown on members, so refresh both lists.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.roles(projectKey) });
      qc.invalidateQueries({ queryKey: qk.members(projectKey) });
    },
  });
}

export function useDeleteRole(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: number) => api.deleteRole(projectKey, roleId),
    // Deleting a role reassigns its members to the default role.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.roles(projectKey) });
      qc.invalidateQueries({ queryKey: qk.members(projectKey) });
    },
  });
}
