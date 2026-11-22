import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { githubGraphql } from './client';

export const githubReplyReviewThread: CustomToolEntry = {
  key: 'github_reply_review_thread',
  group: 'Pull requests',
  label: 'GitHub Reply Review Thread',
  description:
    'Reply in a review thread of a GitHub pull request. The text is markdown. Take the thread id from github_list_review_threads.',
  inputSchema: z.object({
    thread: z.string().min(1).describe('Thread id from github_list_review_threads.'),
    body: z.string().min(1).describe('The reply text, as markdown.'),
  }),
  execute: async (credential, input) => {
    const data = await githubGraphql<{
      addPullRequestReviewThreadReply: { comment: { id: string; url: string } | null } | null;
    }>(
      credential,
      `mutation($input: AddPullRequestReviewThreadReplyInput!) {
        addPullRequestReviewThreadReply(input: $input) { comment { id url } }
      }`,
      { input: { pullRequestReviewThreadId: String(input.thread), body: String(input.body) } },
    );
    const comment = data.addPullRequestReviewThreadReply?.comment;
    return { id: comment?.id ?? null, url: comment?.url ?? null };
  },
};
