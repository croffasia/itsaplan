import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { githubRequest, repoInput, repoPath, type GithubIssue } from './client';

export const githubCreateIssue: CustomToolEntry = {
  key: 'github_create_issue',
  label: 'GitHub Create Issue',
  description:
    'Create an issue in a GitHub repository. The body is markdown. Returns the new issue with its number, which the other GitHub tools take.',
  inputSchema: z.object({
    ...repoInput,
    title: z.string().min(1).describe('Issue title.'),
    body: z.string().optional().describe('Issue description, as markdown.'),
  }),
  execute: async (credential, input) => {
    const issue = await githubRequest<GithubIssue>(
      credential,
      'POST',
      `${repoPath(input.owner, input.repo)}/issues`,
      {
        title: String(input.title),
        ...(input.body !== undefined ? { body: String(input.body) } : {}),
      },
    );
    return {
      number: issue.number,
      title: issue.title ?? null,
      state: issue.state ?? null,
      url: issue.html_url ?? null,
    };
  },
};
