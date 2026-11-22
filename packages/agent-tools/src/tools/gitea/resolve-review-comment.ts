import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { giteaReviewCommentRequest, repoInput, repoPath } from './client';

export const giteaResolveReviewComment: CustomToolEntry = {
  key: 'gitea_resolve_review_comment',
  group: 'Pull requests',
  label: 'Gitea Resolve Review Comment',
  description:
    'Resolve the conversation of a comment on a line of a Gitea pull request diff, or reopen it with resolved false. Take the comment id from gitea_list_review_comments. Needs Gitea 28 or newer; Forgejo has no such API.',
  inputSchema: z.object({
    ...repoInput,
    comment: z.number().int().describe('Comment id from gitea_list_review_comments.'),
    resolved: z
      .boolean()
      .optional()
      .describe('false reopens a resolved conversation (default true).'),
  }),
  execute: async (credential, input) => {
    const resolved = input.resolved !== false;
    await giteaReviewCommentRequest(
      credential,
      'resolve',
      `${repoPath(input.owner, input.repo)}/pulls/comments/${Number(input.comment)}/${resolved ? 'resolve' : 'unresolve'}`,
    );
    return { id: Number(input.comment), resolved };
  },
};
