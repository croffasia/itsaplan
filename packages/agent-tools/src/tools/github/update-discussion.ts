import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { discussionId, discussionInput, githubGraphql, repoInput } from './client';

interface Discussion {
  number: number;
  closed: boolean;
  url: string;
}

const FIELDS = 'discussion { number closed url }';

// GitHub has one mutation for the edit and one each for closing and reopening, so a
// call that does both sends two.
export const githubUpdateDiscussion: CustomToolEntry = {
  key: 'github_update_discussion',
  label: 'GitHub Update Discussion',
  description:
    'Update a discussion in a GitHub repository: change its title or markdown body, or close and reopen it. Give at least one of title, body or state.',
  inputSchema: z.object({
    ...repoInput,
    discussion: discussionInput,
    title: z.string().min(1).optional().describe('New title.'),
    body: z.string().min(1).optional().describe('New text, as markdown.'),
    state: z
      .enum(['open', 'closed'])
      .optional()
      .describe('closed closes the discussion as resolved, open reopens it.'),
  }),
  execute: async (credential, input) => {
    if (input.title === undefined && input.body === undefined && input.state === undefined) {
      throw new Error('Give at least one of title, body or state to update.');
    }
    const id = await discussionId(credential, input.owner, input.repo, input.discussion);
    let discussion: Discussion | undefined;
    if (input.title !== undefined || input.body !== undefined) {
      const data = await githubGraphql<{ updateDiscussion: { discussion: Discussion } }>(
        credential,
        `mutation($input: UpdateDiscussionInput!) { updateDiscussion(input: $input) { ${FIELDS} } }`,
        {
          input: {
            discussionId: id,
            ...(input.title !== undefined ? { title: String(input.title) } : {}),
            ...(input.body !== undefined ? { body: String(input.body) } : {}),
          },
        },
      );
      discussion = data.updateDiscussion.discussion;
    }
    if (input.state === 'closed') {
      const data = await githubGraphql<{ closeDiscussion: { discussion: Discussion } }>(
        credential,
        `mutation($input: CloseDiscussionInput!) { closeDiscussion(input: $input) { ${FIELDS} } }`,
        { input: { discussionId: id, reason: 'RESOLVED' } },
      );
      discussion = data.closeDiscussion.discussion;
    } else if (input.state === 'open') {
      const data = await githubGraphql<{ reopenDiscussion: { discussion: Discussion } }>(
        credential,
        `mutation($input: ReopenDiscussionInput!) { reopenDiscussion(input: $input) { ${FIELDS} } }`,
        { input: { discussionId: id } },
      );
      discussion = data.reopenDiscussion.discussion;
    }
    return discussion!;
  },
};
