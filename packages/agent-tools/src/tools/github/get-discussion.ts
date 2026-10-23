import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { discussionInput, githubGraphql, numberRef, repoInput } from './client';

const REPLIES = 20;

interface Reply {
  id: string;
  url: string;
  body: string;
  createdAt: string;
  author: { login: string } | null;
}

interface Comment extends Reply {
  isAnswer: boolean;
  replies: { totalCount: number; nodes: Reply[] };
}

interface Discussion {
  number: number;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  closed: boolean;
  isAnswered: boolean | null;
  author: { login: string } | null;
  category: { name: string };
  comments: {
    totalCount: number;
    nodes: Comment[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

function reply(r: Reply) {
  return {
    id: r.id,
    author: r.author?.login ?? null,
    body: r.body,
    createdAt: r.createdAt,
    url: r.url,
  };
}

// ponytail: up to REPLIES replies per comment, the rest only counted (moreReplies);
// page DiscussionComment.replies if long threads turn up.
export const githubGetDiscussion: CustomToolEntry = {
  key: 'github_get_discussion',
  label: 'GitHub Get Discussion',
  description:
    'Read a discussion in a GitHub repository: its markdown body, category and state, and its comments with the replies under each. Returns nextCursor when there are more comments; pass it as cursor to get the next page.',
  inputSchema: z.object({
    ...repoInput,
    discussion: discussionInput,
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('How many comments to return, 1-50 (default 20).'),
    cursor: z.string().optional().describe('nextCursor from the previous page of comments.'),
  }),
  execute: async (credential, input) => {
    const number = numberRef(input.discussion, 'discussion');
    const data = await githubGraphql<{ repository: { discussion: Discussion | null } | null }>(
      credential,
      `query($owner: String!, $repo: String!, $number: Int!, $first: Int!, $after: String, $replies: Int!) {
        repository(owner: $owner, name: $repo) {
          discussion(number: $number) {
            number title body url createdAt closed isAnswered
            author { login }
            category { name }
            comments(first: $first, after: $after) {
              totalCount
              nodes {
                id url body createdAt isAnswer
                author { login }
                replies(first: $replies) {
                  totalCount
                  nodes { id url body createdAt author { login } }
                }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      }`,
      {
        owner: String(input.owner),
        repo: String(input.repo),
        number,
        first: input.limit ?? 20,
        after: input.cursor ?? null,
        replies: REPLIES,
      },
    );
    const d = data.repository?.discussion;
    if (!d) throw new Error(`Discussion #${number} not found in ${input.owner}/${input.repo}.`);
    return {
      number: d.number,
      title: d.title,
      body: d.body,
      author: d.author?.login ?? null,
      category: d.category.name,
      closed: d.closed,
      answered: d.isAnswered ?? false,
      url: d.url,
      createdAt: d.createdAt,
      commentCount: d.comments.totalCount,
      comments: d.comments.nodes.map((c) => ({
        ...reply(c),
        isAnswer: c.isAnswer,
        replies: c.replies.nodes.map(reply),
        ...(c.replies.totalCount > c.replies.nodes.length
          ? { moreReplies: c.replies.totalCount - c.replies.nodes.length }
          : {}),
      })),
      nextCursor: d.comments.pageInfo.hasNextPage ? d.comments.pageInfo.endCursor : null,
    };
  },
};
