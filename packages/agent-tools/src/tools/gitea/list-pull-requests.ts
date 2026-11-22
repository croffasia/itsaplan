import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { giteaRequest, repoInput, repoPath, type GiteaPull } from './client';

export const giteaListPullRequests: CustomToolEntry = {
  key: 'gitea_list_pull_requests',
  group: 'Pull requests',
  label: 'Gitea List Pull Requests',
  description:
    'List pull requests in a Gitea or Forgejo repository. Returns each pull request with its number, which the other Gitea pull request tools take.',
  inputSchema: z.object({
    ...repoInput,
    state: z.enum(['open', 'closed', 'all']).optional().describe('Filter by state (default open).'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('How many pull requests to return per page, 1-50 (default 10).'),
    page: z.number().int().min(1).optional().describe('Page number (default 1).'),
  }),
  execute: async (credential, input) => {
    const query = new URLSearchParams({
      state: input.state ? String(input.state) : 'open',
      limit: String(input.limit ?? 10),
      page: String(input.page ?? 1),
    });
    const pulls = await giteaRequest<GiteaPull[]>(
      credential,
      'GET',
      `${repoPath(input.owner, input.repo)}/pulls?${query}`,
    );
    return {
      pullRequests: pulls.map((pull) => ({
        number: pull.number,
        title: pull.title ?? '',
        state: pull.state ?? null,
        draft: pull.draft ?? false,
        merged: pull.merged ?? false,
        author: pull.user?.login ?? null,
        headBranch: pull.head?.ref ?? null,
        baseBranch: pull.base?.ref ?? null,
        url: pull.html_url ?? null,
        updatedAt: pull.updated_at ?? null,
      })),
    };
  },
};
