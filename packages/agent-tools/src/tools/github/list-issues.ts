import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { githubRequest, repoInput, repoPath, type GithubIssue } from './client';

// GitHub returns pull requests from this endpoint too and has no filter for them, so a
// page can hold fewer issues than the limit.
export const githubListIssues: CustomToolEntry = {
  key: 'github_list_issues',
  label: 'GitHub List Issues',
  description:
    'List issues in a GitHub repository, most recently created first. Returns each issue with its number, which the other GitHub tools take. Pull requests are not included, so a page can hold fewer issues than the limit; ask for the next page to see more.',
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
      state: input.state ? String(input.state) : 'open',
      per_page: String(input.limit ?? 10),
      page: String(input.page ?? 1),
    });
    const items = await githubRequest<GithubIssue[]>(
      credential,
      'GET',
      `${repoPath(input.owner, input.repo)}/issues?${query}`,
    );
    return {
      issues: items
        .filter((issue) => !issue.pull_request)
        .map((issue) => ({
          number: issue.number,
          title: issue.title ?? '',
          state: issue.state ?? null,
          url: issue.html_url ?? null,
          updatedAt: issue.updated_at ?? null,
          labels: (issue.labels ?? []).map((label) =>
            typeof label === 'string' ? label : (label.name ?? ''),
          ),
        })),
    };
  },
};
