import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { githubRequest, issueInput, numberRef, repoInput, repoPath } from './client';

export const githubCommentIssue: CustomToolEntry = {
  key: 'github_comment_issue',
  label: 'GitHub Comment Issue',
  description:
    'Comment on an issue in a GitHub repository. The text is markdown. Returns the id of the new comment.',
  inputSchema: z.object({
    ...repoInput,
    issue: issueInput,
    body: z.string().min(1).describe('The comment text, as markdown.'),
  }),
  execute: async (credential, input) => {
    const comment = await githubRequest<{ id?: number; html_url?: string }>(
      credential,
      'POST',
      `${repoPath(input.owner, input.repo)}/issues/${numberRef(input.issue, 'issue')}/comments`,
      { body: String(input.body) },
    );
    return { id: comment.id ?? null, url: comment.html_url ?? null };
  },
};
