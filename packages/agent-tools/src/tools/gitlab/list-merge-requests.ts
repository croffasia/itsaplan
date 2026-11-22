import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import {
  gitlabRequest,
  projectInput,
  projectPath,
  stateOf,
  STATES,
  type GitlabMergeRequest,
} from './client';

export const gitlabListMergeRequests: CustomToolEntry = {
  key: 'gitlab_list_merge_requests',
  group: 'Merge requests',
  label: 'GitLab List Merge Requests',
  description:
    'List merge requests in a GitLab project, most recently created first. Returns each merge request with its number, which the other GitLab merge request tools take.',
  inputSchema: z.object({
    project: projectInput,
    state: z
      .enum(['open', 'closed', 'merged', 'all'])
      .optional()
      .describe('Filter by state (default open). closed means closed without merging.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('How many merge requests to return per page, 1-50 (default 10).'),
    page: z.number().int().min(1).optional().describe('Page number (default 1).'),
  }),
  execute: async (credential, input) => {
    const query = new URLSearchParams({
      state: STATES[(input.state as keyof typeof STATES | undefined) ?? 'open'],
      per_page: String(input.limit ?? 10),
      page: String(input.page ?? 1),
    });
    const items = await gitlabRequest<GitlabMergeRequest[]>(
      credential,
      'GET',
      `${projectPath(input.project)}/merge_requests?${query}`,
    );
    return {
      mergeRequests: items.map((mr) => ({
        number: mr.iid,
        title: mr.title ?? '',
        state: stateOf(mr),
        draft: mr.draft ?? false,
        author: mr.author?.username ?? null,
        sourceBranch: mr.source_branch ?? null,
        targetBranch: mr.target_branch ?? null,
        url: mr.web_url ?? null,
        updatedAt: mr.updated_at ?? null,
      })),
    };
  },
};
