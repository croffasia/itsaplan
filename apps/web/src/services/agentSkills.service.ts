// The team's skill library, and the skills enabled on one of its agents. Both belong to
// the team, so every hook here is keyed by it.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type NewSkillInput,
  type SkillPatch,
  listSkillOptions,
  getSkill,
  listSkills,
  createSkill,
  discoverGithubSkills,
  updateSkill,
  deleteSkill,
  addSkillReference,
  updateSkillReferenceContent,
  deleteSkillReference,
  listAgentSkills,
  setAgentSkills,
} from '@/lib/api/endpoints/agentSkills';
import type { PageParams } from '@/lib/api/core/paging';
import { qk } from '@/services/queryKeys';

// The whole library, which the agent editor's skill picker needs entire.
export function useSkillOptionsQuery(teamId: number | null) {
  return useQuery({
    queryKey: qk.agentSkillOptions(teamId ?? 0),
    queryFn: () => listSkillOptions(teamId!),
    enabled: teamId != null,
  });
}

// One skill, live: the editor reads it back so adding or deleting a reference file
// shows up in its file list.
export function useSkillQuery(teamId: number, skillId: number) {
  return useQuery({
    queryKey: qk.agentSkill(teamId, skillId),
    queryFn: () => getSkill(teamId, skillId),
  });
}

// One page of the library, for the section that lists it.
export function useSkillsPageQuery(teamId: number | null, params: PageParams) {
  return useQuery({
    queryKey: qk.agentSkillPage(teamId ?? 0, params),
    queryFn: () => listSkills(teamId!, params),
    enabled: teamId != null,
    placeholderData: keepPreviousData,
  });
}

export function useCreateSkill(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewSkillInput) => createSkill(teamId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.agentSkills(teamId) });
      // The team list carries how many skills the team holds.
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}

// Lists the skills at a GitHub URL so the user can pick which to import. Read-only:
// no cache invalidation.
export function useDiscoverGithubSkills(teamId: number) {
  return useMutation({
    mutationFn: (url: string) => discoverGithubSkills(teamId, url),
  });
}

export function useUpdateSkill(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: SkillPatch }) =>
      updateSkill(teamId, id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.agentSkills(teamId) }),
  });
}

export function useDeleteSkill(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSkill(teamId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.agentSkills(teamId) });
      void qc.invalidateQueries({ queryKey: qk.teams });
    },
  });
}

export function useAddSkillReference(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => addSkillReference(teamId, id, file),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.agentSkills(teamId) }),
  });
}

export function useUpdateSkillReference(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, path, content }: { id: number; path: string; content: string }) =>
      updateSkillReferenceContent(teamId, id, path, content),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.agentSkills(teamId) }),
  });
}

export function useDeleteSkillReference(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, path }: { id: number; path: string }) =>
      deleteSkillReference(teamId, id, path),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.agentSkills(teamId) }),
  });
}

// The skills enabled on one agent (the agent editor's Skills tab).
export function useAgentSkillsQuery(teamId: number | null, agentId: number | null) {
  return useQuery({
    queryKey: qk.agentSkillLinks(teamId ?? 0, agentId ?? 0),
    queryFn: () => listAgentSkills(teamId!, agentId!),
    enabled: teamId != null && agentId != null,
  });
}

export function useSetAgentSkills(teamId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, skillIds }: { agentId: number; skillIds: number[] }) =>
      setAgentSkills(teamId!, agentId, skillIds),
    onSuccess: (_data, { agentId }) => {
      if (teamId != null)
        void qc.invalidateQueries({ queryKey: qk.agentSkillLinks(teamId, agentId) });
    },
  });
}
