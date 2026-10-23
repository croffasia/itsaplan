import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { githubGraphql, repoInput } from './client';

interface DiscussionNode {
  number: number;
  title: string;
  url: string;
  closed: boolean;
  isAnswered: boolean | null;
  updatedAt: string;
  category: { name: string };
  comments: { totalCount: number };
}

const STATES = { open: ['OPEN'], closed: ['CLOSED'], all: [] };

export const githubListDiscussions: CustomToolEntry = {
  key: 'github_list_discussions',
  label: 'GitHub List Discussions',
  description:
    'List discussions in a GitHub repository, most recently updated first. Returns each discussion with its number, which the other GitHub discussion tools take, and nextCursor when there are more; pass it as cursor to get the next page.',
  inputSchema: z.object({
    ...repoInput,
    state: z.enum(['open', 'closed', 'all']).optional().describe('Filter by state (default open).'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('How many discussions to return, 1-50 (default 10).'),
    cursor: z.string().optional().describe('nextCursor from the previous page.'),
  }),
  execute: async (credential, input) => {
    const data = await githubGraphql<{
      repository: {
        discussions: {
          nodes: DiscussionNode[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } | null;
    }>(
      credential,
      `query($owner: String!, $repo: String!, $first: Int!, $after: String, $states: [DiscussionState!]) {
        repository(owner: $owner, name: $repo) {
          discussions(first: $first, after: $after, states: $states, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes {
              number title url closed isAnswered updatedAt
              category { name }
              comments { totalCount }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`,
      {
        owner: String(input.owner),
        repo: String(input.repo),
        first: input.limit ?? 10,
        after: input.cursor ?? null,
        states: STATES[(input.state as keyof typeof STATES | undefined) ?? 'open'],
      },
    );
    if (!data.repository) throw new Error(`Repository ${input.owner}/${input.repo} not found.`);
    const { nodes, pageInfo } = data.repository.discussions;
    return {
      discussions: nodes.map((d) => ({
        number: d.number,
        title: d.title,
        category: d.category.name,
        closed: d.closed,
        answered: d.isAnswered ?? false,
        comments: d.comments.totalCount,
        url: d.url,
        updatedAt: d.updatedAt,
      })),
      nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
    };
  },
};
