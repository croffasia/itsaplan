import { request, uploadFile } from '@/lib/api/core/client';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';

// A reference file of a skill (metadata only).
export interface SkillRef {
  path: string;
  s3Key: string;
  size: number;
}

// A skill in the team library: a SKILL.md plus optional reference files, given to
// the internal agents of the team's projects. Content lives in the object store;
// this is the metadata.
export interface AgentSkill {
  id: number;
  teamId: number;
  name: string;
  description: string;
  source: 'upload' | 'inline' | 'github';
  sourceUrl: string | null;
  files: SkillRef[];
  createdAt: string;
}

export interface NewSkillInput {
  source: 'upload' | 'inline' | 'github';
  name?: string | null;
  description?: string | null;
  markdown?: string;
  sourceUrl?: string | null;
}

export interface SkillPatch {
  name?: string;
  description?: string;
  markdown?: string;
}

// A skill found at a GitHub URL by the discover endpoint. `url` is a ready-to-import
// link for that single skill.
export interface GithubSkillCandidate {
  name: string;
  description: string;
  subpath: string;
  url: string;
}

// Agent skills: the team skill library and the skills enabled on an agent.
export const listSkills = (teamId: number, params: PageParams) =>
  request<Page<AgentSkill>>(`/teams/${teamId}/agent-skills${pageQuery(params)}`);

// The whole library, which the agent editor's skill picker needs entire.
export const listSkillOptions = (teamId: number) =>
  request<AgentSkill[]>(`/teams/${teamId}/agent-skills/options`);

export const getSkill = (teamId: number, skillId: number) =>
  request<AgentSkill>(`/teams/${teamId}/agent-skills/${skillId}`);

export const getSkillMarkdown = (teamId: number, skillId: number) =>
  request<{ markdown: string }>(`/teams/${teamId}/agent-skills/${skillId}/markdown`);

export const getSkillReferenceContent = (teamId: number, skillId: number, path: string) =>
  request<{ content: string }>(
    `/teams/${teamId}/agent-skills/${skillId}/references/content?path=${encodeURIComponent(path)}`,
  );

export const createSkill = (teamId: number, input: NewSkillInput) =>
  request<AgentSkill>(`/teams/${teamId}/agent-skills`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const discoverGithubSkills = (teamId: number, url: string) =>
  request<GithubSkillCandidate[]>(`/teams/${teamId}/agent-skills/github/discover`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });

export const updateSkill = (teamId: number, skillId: number, patch: SkillPatch) =>
  request<AgentSkill>(`/teams/${teamId}/agent-skills/${skillId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteSkill = (teamId: number, skillId: number) =>
  request<void>(`/teams/${teamId}/agent-skills/${skillId}`, { method: 'DELETE' });

export const addSkillReference = (teamId: number, skillId: number, file: File) =>
  uploadFile<AgentSkill>(`/teams/${teamId}/agent-skills/${skillId}/references`, 'POST', file);

export const updateSkillReferenceContent = (
  teamId: number,
  skillId: number,
  path: string,
  content: string,
) =>
  request<AgentSkill>(`/teams/${teamId}/agent-skills/${skillId}/references/content`, {
    method: 'PATCH',
    body: JSON.stringify({ path, content }),
  });

export const deleteSkillReference = (teamId: number, skillId: number, path: string) =>
  request<AgentSkill>(
    `/teams/${teamId}/agent-skills/${skillId}/references?path=${encodeURIComponent(path)}`,
    { method: 'DELETE' },
  );

export const listAgentSkills = (teamId: number, agentId: number) =>
  request<AgentSkill[]>(`/teams/${teamId}/ai-agents/${agentId}/skills`);

export const setAgentSkills = (teamId: number, agentId: number, skillIds: number[]) =>
  request<AgentSkill[]>(`/teams/${teamId}/ai-agents/${agentId}/skills`, {
    method: 'PUT',
    body: JSON.stringify({ skillIds }),
  });
