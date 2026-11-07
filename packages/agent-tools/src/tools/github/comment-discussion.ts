import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { discussionId, discussionInput, githubGraphql, repoInput } from './client';

export const githubCommentDiscussion: CustomToolEntry = {
  key: 'github_comment_discussion',
  label: 'GitHub Comment Discussion',
  description:
    'Comment on a discussion in a GitHub repository. The text is markdown. Returns the id and the URL of the new comment.',
  inputSchema: z.object({
    ...repoInput,
    discussion: discussionInput,
    body: z.string().min(1).describe('The comment text, as markdown.'),
  }),
  execute: async (credential, input) => {
    const id = await discussionId(credential, input.owner, input.repo, input.discussion);
    const data = await githubGraphql<{
      addDiscussionComment: { comment: { id: string; url: string } };
    }>(
      credential,
      `mutation($input: AddDiscussionCommentInput!) {
        addDiscussionComment(input: $input) { comment { id url } }
      }`,
      { input: { discussionId: id, body: String(input.body) } },
    );
    const comment = data.addDiscussionComment.comment;
    return { id: comment.id, url: comment.url };
  },
};
