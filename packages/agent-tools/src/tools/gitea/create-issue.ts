import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { giteaRequest, repoPath, type GiteaIssue } from './client';

// Opens a new issue in a repository.
export const giteaCreateIssue: CustomToolEntry = {
  key: 'gitea_create_issue',
  label: 'Gitea Create Issue',
  description:
    'Create an issue in a Gitea repository. The body is markdown. Returns the new issue with its number, which the other Gitea tools take.',
  inputSchema: z.object({
    owner: z.string().min(1).describe('Repository owner (user or organization).'),
    repo: z.string().min(1).describe('Repository name.'),
    title: z.string().min(1).describe('Issue title.'),
    body: z.string().optional().describe('Issue description, as markdown.'),
  }),
  execute: async (credential, input) => {
    const issue = await giteaRequest<GiteaIssue>(
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
