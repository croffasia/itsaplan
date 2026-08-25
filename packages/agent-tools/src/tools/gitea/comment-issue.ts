import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { giteaRequest, issueRef, repoPath } from './client';

// Comments on an issue.
export const giteaCommentIssue: CustomToolEntry = {
  key: 'gitea_comment_issue',
  label: 'Gitea Comment Issue',
  description:
    'Comment on an issue in a Gitea repository. The text is markdown. Returns the id of the new comment.',
  inputSchema: z.object({
    owner: z.string().min(1).describe('Repository owner (user or organization).'),
    repo: z.string().min(1).describe('Repository name.'),
    issue: z.union([z.number(), z.string()]).describe('Issue number, #number, or the issue URL.'),
    body: z.string().min(1).describe('The comment text, as markdown.'),
  }),
  execute: async (credential, input) => {
    const comment = await giteaRequest<{ id?: number; html_url?: string }>(
      credential,
      'POST',
      `${repoPath(input.owner, input.repo)}/issues/${issueRef(input.issue)}/comments`,
      { body: String(input.body) },
    );
    return { id: comment.id ?? null, url: comment.html_url ?? null };
  },
};
