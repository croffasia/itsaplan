import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addWorkspaceAdmin,
  createWorkspaceScimToken,
  deleteWorkspace,
  getWorkspace,
  getWorkspaceScim,
  listWorkspaceManagerCandidates,
  listWorkspaceManagers,
  listWorkspaceProjectOptions,
  listWorkspaceScimGroups,
  listWorkspaces,
  removeWorkspaceAdmin,
  setWorkspaceScimGroupMappings,
  updateWorkspace,
  type WorkspacePatch,
  updateWorkspaceScim,
} from '@/lib/api/endpoints/workspaces';
import { qk } from '@/services/queryKeys';

export function useWorkspacesQuery() {
  return useQuery({ queryKey: qk.workspaces, queryFn: () => listWorkspaces() });
}

export function useWorkspaceQuery(workspaceId: number) {
  return useQuery({
    queryKey: qk.workspace(workspaceId),
    queryFn: () => getWorkspace(workspaceId),
  });
}

export function useUpdateWorkspace(workspaceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: WorkspacePatch) => updateWorkspace(workspaceId, patch),
    onSuccess: (workspace) => {
      qc.setQueryData(qk.workspace(workspaceId), workspace);
      void qc.invalidateQueries({ queryKey: qk.workspaces });
    },
  });
}

// Its teams go with it, so the team list changes as well as the workspace list.
export function useDeleteWorkspace(workspaceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteWorkspace(workspaceId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: qk.workspace(workspaceId) });
      void qc.invalidateQueries({ queryKey: qk.workspaces });
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}

export function useWorkspaceManagersQuery(workspaceId: number) {
  return useQuery({
    queryKey: qk.workspaceManagers(workspaceId),
    queryFn: () => listWorkspaceManagers(workspaceId),
  });
}

export function useWorkspaceManagerCandidatesQuery(workspaceId: number, search: string) {
  return useQuery({
    queryKey: qk.workspaceManagerCandidates(workspaceId, search),
    queryFn: () => listWorkspaceManagerCandidates(workspaceId, search),
    placeholderData: keepPreviousData,
  });
}

// The manager list, the candidates and the counter on the workspace all change with it.
function useManagerMutation<T>(workspaceId: number, write: (userId: string) => Promise<T>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: write,
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.workspace(workspaceId) }),
  });
}

export function useAddWorkspaceAdmin(workspaceId: number) {
  return useManagerMutation(workspaceId, (userId) => addWorkspaceAdmin(workspaceId, userId));
}

export function useRemoveWorkspaceAdmin(workspaceId: number) {
  return useManagerMutation(workspaceId, (userId) => removeWorkspaceAdmin(workspaceId, userId));
}

// SCIM provisioning: the token an identity provider authenticates with, and what the
// groups it pushes grant. A workspace's, or the instance's in god mode for null.
export function useWorkspaceScimQuery(workspaceId: number | null) {
  return useQuery({
    queryKey: qk.scim(workspaceId),
    queryFn: () => getWorkspaceScim(workspaceId),
  });
}

export function useUpdateWorkspaceScim(workspaceId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { enabled: boolean }) => updateWorkspaceScim(workspaceId, patch),
    onSuccess: (data) => qc.setQueryData(qk.scim(workspaceId), data),
  });
}

export function useCreateWorkspaceScimToken(workspaceId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => createWorkspaceScimToken(workspaceId),
    // The response is the token itself, not the settings, so the redacted view has
    // to be refetched for its new prefix.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.scim(workspaceId), exact: true }),
  });
}

export function useWorkspaceScimGroupsQuery(workspaceId: number | null) {
  return useQuery({
    queryKey: qk.scimGroups(workspaceId),
    queryFn: () => listWorkspaceScimGroups(workspaceId),
  });
}

export function useSetWorkspaceScimGroupMappings(workspaceId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      groupId: string;
      mappings: { projectId: number; role: 'owner' | 'member'; roleId: number | null }[];
    }) => setWorkspaceScimGroupMappings(workspaceId, input.groupId, input.mappings),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.scimGroups(workspaceId) }),
  });
}

// Every project a group may grant, for the group mapping picker.
export function useWorkspaceProjectOptionsQuery(workspaceId: number | null) {
  return useQuery({
    queryKey: qk.scimProjects(workspaceId),
    queryFn: () => listWorkspaceProjectOptions(workspaceId),
  });
}
