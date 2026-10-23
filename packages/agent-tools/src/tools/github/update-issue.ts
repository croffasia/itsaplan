import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import {
  githubRequest,
  issueInput,
  numberRef,
  repoInput,
  repoPath,
  type GithubIssue,
} from './client';

export const githubUpdateIssue: CustomToolEntry = {
  key: 'github_update_issue',
  label: 'GitHub Update Issue',
  description:
    'Update an issue in a GitHub repository: change its title or markdown body, or close and reopen it. Give at least one of title, body or state.',
  inputSchema: z.object({
    ...repoInput,
    issue: issueInput,
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
    const issue = await githubRequest<GithubIssue>(
      credential,
      'PATCH',
      `${repoPath(input.owner, input.repo)}/issues/${numberRef(input.issue, 'issue')}`,
      patch,
    );
    return {
      number: issue.number,
      state: issue.state ?? null,
      url: issue.html_url ?? null,
    };
  },
};
