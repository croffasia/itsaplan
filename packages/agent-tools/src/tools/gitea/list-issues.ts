import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { giteaRequest, repoInput, repoPath, type GiteaIssue } from './client';

// Lists a repository's issues. Pull requests share the numbering with issues in
// Gitea, so they are filtered out server-side with type=issues.
export const giteaListIssues: CustomToolEntry = {
  key: 'gitea_list_issues',
  group: 'Issues',
  label: 'Gitea List Issues',
  description:
    'List issues in a Gitea repository. Returns each issue with its number, which the other Gitea tools take. Pull requests are not included.',
  inputSchema: z.object({
    ...repoInput,
    state: z.enum(['open', 'closed', 'all']).optional().describe('Filter by state (default open).'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('How many issues to return per page, 1-50 (default 10).'),
    page: z.number().int().min(1).optional().describe('Page number (default 1).'),
  }),
  execute: async (credential, input) => {
    const query = new URLSearchParams({
      type: 'issues',
      state: input.state ? String(input.state) : 'open',
      limit: String(input.limit ?? 10),
      page: String(input.page ?? 1),
    });
    const issues = await giteaRequest<GiteaIssue[]>(
      credential,
      'GET',
      `${repoPath(input.owner, input.repo)}/issues?${query}`,
    );
    return {
      issues: issues.map((issue) => ({
        number: issue.number,
        title: issue.title ?? '',
        state: issue.state ?? null,
        url: issue.html_url ?? null,
        updatedAt: issue.updated_at ?? null,
        labels: (issue.labels ?? []).map((label) => label.name ?? ''),
      })),
    };
  },
};
