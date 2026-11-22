import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { giteaReviewCommentRequest, numberRef, pullInput, repoInput, repoPath } from './client';

export const giteaReplyReviewComment: CustomToolEntry = {
  key: 'gitea_reply_review_comment',
  group: 'Pull requests',
  label: 'Gitea Reply Review Comment',
  description:
    'Reply in the conversation of a comment on a line of a Gitea pull request diff. The text is markdown. Take the comment id from gitea_list_review_comments. Needs Gitea 28 or newer; Forgejo has no such API.',
  inputSchema: z.object({
    ...repoInput,
    pull: pullInput,
    comment: z.number().int().describe('Comment id from gitea_list_review_comments.'),
    body: z.string().min(1).describe('The reply text, as markdown.'),
  }),
  execute: async (credential, input) => {
    const reply = await giteaReviewCommentRequest<{ id?: number; html_url?: string }>(
      credential,
      'reply to',
      `${repoPath(input.owner, input.repo)}/pulls/${numberRef(input.pull)}/comments/${Number(input.comment)}/replies`,
      { body: String(input.body) },
    );
    return { id: reply.id ?? null, url: reply.html_url ?? null };
  },
};
