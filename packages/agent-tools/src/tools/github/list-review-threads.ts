import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { githubGraphql, numberRef, pullInput, repoInput } from './client';

const COMMENTS = 100;

interface Thread {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  originalLine: number | null;
  diffSide: string;
  comments: {
    totalCount: number;
    nodes: { author: { login: string } | null; body: string; createdAt: string; url: string }[];
  };
}

interface PullThreads {
  reviewThreads: {
    nodes: Thread[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

// ponytail: up to COMMENTS comments per thread, the rest only counted (moreComments);
// page PullRequestReviewThread.comments if longer threads turn up.
export const githubListReviewThreads: CustomToolEntry = {
  key: 'github_list_review_threads',
  group: 'Pull requests',
  label: 'GitHub List Review Threads',
  description:
    'List the review threads of a GitHub pull request: the comments on lines of its diff, grouped by thread, and whether each thread is resolved. Returns each thread with its id, which github_reply_review_thread and github_resolve_review_thread take. Returns nextCursor when there are more threads; pass it as cursor to get the next page.',
  inputSchema: z.object({
    ...repoInput,
    pull: pullInput,
    cursor: z.string().optional().describe('nextCursor from the previous page of threads.'),
  }),
  execute: async (credential, input) => {
    const number = numberRef(input.pull, 'pull request');
    const data = await githubGraphql<{ repository: { pullRequest: PullThreads | null } | null }>(
      credential,
      `query($owner: String!, $repo: String!, $number: Int!, $after: String, $comments: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewThreads(first: 50, after: $after) {
              nodes {
                id isResolved isOutdated path line originalLine diffSide
                comments(first: $comments) {
                  totalCount
                  nodes { body createdAt url author { login } }
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
        after: input.cursor ?? null,
        comments: COMMENTS,
      },
    );
    const pull = data.repository?.pullRequest;
    if (!pull)
      throw new Error(`Pull request #${number} not found in ${input.owner}/${input.repo}.`);
    const { nodes, pageInfo } = pull.reviewThreads;
    return {
      threads: nodes.map((t) => ({
        id: t.id,
        resolved: t.isResolved,
        outdated: t.isOutdated,
        path: t.path,
        line: t.line ?? t.originalLine,
        side: t.diffSide === 'LEFT' ? 'old' : 'new',
        comments: t.comments.nodes.map((c) => ({
          author: c.author?.login ?? null,
          body: c.body,
          createdAt: c.createdAt,
          url: c.url,
        })),
        ...(t.comments.totalCount > t.comments.nodes.length
          ? { moreComments: t.comments.totalCount - t.comments.nodes.length }
          : {}),
      })),
      nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
    };
  },
};
