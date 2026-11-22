import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { giteaRequest, numberRef, repoInput, repoPath } from './client';

export const giteaCommentIssue: CustomToolEntry = {
  key: 'gitea_comment_issue',
  group: 'Issues',
  label: 'Gitea Comment Issue',
  description:
    'Comment on an issue or a pull request in a Gitea repository. The text is markdown. Returns the id of the new comment.',
  inputSchema: z.object({
    ...repoInput,
    issue: z
      .union([z.number(), z.string()])
      .describe('Issue or pull request number, #number, or its URL.'),
    body: z.string().min(1).describe('The comment text, as markdown.'),
  }),
  execute: async (credential, input) => {
    const comment = await giteaRequest<{ id?: number; html_url?: string }>(
      credential,
      'POST',
      `${repoPath(input.owner, input.repo)}/issues/${numberRef(input.issue)}/comments`,
      { body: String(input.body) },
    );
    return { id: comment.id ?? null, url: comment.html_url ?? null };
  },
};
