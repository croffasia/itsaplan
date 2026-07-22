import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type NewSkillInput, type SkillPatch } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useSkillsQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.agentSkills(projectKey ?? ''),
    queryFn: () => api.listSkills(projectKey!),
    enabled: projectKey != null,
  });
}

export function useCreateSkill(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewSkillInput) => api.createSkill(projectKey!, input),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.agentSkills(projectKey) });
    },
  });
}

// Lists the skills at a GitHub URL so the user can pick which to import. Read-only:
// no cache invalidation.
export function useDiscoverGithubSkills(projectKey: string | null) {
  return useMutation({
    mutationFn: (url: string) => api.discoverGithubSkills(projectKey!, url),
  });
}

export function useUpdateSkill(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: SkillPatch }) =>
      api.updateSkill(projectKey!, id, patch),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.agentSkills(projectKey) });
    },
  });
}

export function useDeleteSkill(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteSkill(projectKey!, id),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.agentSkills(projectKey) });
    },
  });
}

export function useAddSkillReference(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      api.addSkillReference(projectKey!, id, file),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.agentSkills(projectKey) });
    },
  });
}

export function useUpdateSkillReference(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, path, content }: { id: number; path: string; content: string }) =>
      api.updateSkillReferenceContent(projectKey!, id, path, content),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.agentSkills(projectKey) });
    },
  });
}

export function useDeleteSkillReference(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, path }: { id: number; path: string }) =>
      api.deleteSkillReference(projectKey!, id, path),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.agentSkills(projectKey) });
    },
  });
}

// The skills enabled on one agent (the agent editor's Skills tab).
export function useAgentSkillsQuery(projectKey: string | null, agentId: number | null) {
  return useQuery({
    queryKey: qk.agentSkillLinks(projectKey ?? '', agentId ?? 0),
    queryFn: () => api.listAgentSkills(projectKey!, agentId!),
    enabled: projectKey != null && agentId != null,
  });
}

export function useSetAgentSkills(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, skillIds }: { agentId: number; skillIds: number[] }) =>
      api.setAgentSkills(projectKey!, agentId, skillIds),
    onSuccess: (_data, { agentId }) => {
      if (projectKey)
        void qc.invalidateQueries({ queryKey: qk.agentSkillLinks(projectKey, agentId) });
    },
  });
}
