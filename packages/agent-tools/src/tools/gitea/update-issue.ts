import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { giteaRequest, issueRef, repoPath, type GiteaIssue } from './client';

// Edits an issue's title, body, or state.
export const giteaUpdateIssue: CustomToolEntry = {
  key: 'gitea_update_issue',
  label: 'Gitea Update Issue',
  description:
    'Update an issue in a Gitea repository: change its title or markdown body, or close and reopen it. Give at least one of title, body or state.',
  inputSchema: z.object({
    owner: z.string().min(1).describe('Repository owner (user or organization).'),
    repo: z.string().min(1).describe('Repository name.'),
    issue: z.union([z.number(), z.string()]).describe('Issue number, #number, or the issue URL.'),
    title: z.string().min(1).optional().describe('New title.'),
    body: z.string().optional().describe('New description, as markdown.'),
    state: z
      .enum(['open', 'closed'])
      .optional()
      .describe('closed closes the issue, open reopens it.'),
  }),
  execute: async (credential, input) => {
    if (input.title === undefined && input.body === undefined && input.state === undefined) {
      throw new Error('Give at least one of title, body or state to update.');
    }
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = String(input.title);
    if (input.body !== undefined) patch.body = String(input.body);
    if (input.state !== undefined) patch.state = input.state;
    const issue = await giteaRequest<GiteaIssue>(
      credential,
      'PATCH',
      `${repoPath(input.owner, input.repo)}/issues/${issueRef(input.issue)}`,
      patch,
    );
    return {
      number: issue.number,
      state: issue.state ?? null,
      url: issue.html_url ?? null,
    };
  },
};
