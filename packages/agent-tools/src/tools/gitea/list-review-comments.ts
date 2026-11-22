import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { giteaRequest, numberRef, pullInput, repoInput, repoPath } from './client';

const PAGE = 50;
const MAX_PAGES = 20;

interface Review {
  id: number;
  comments_count?: number;
}

interface ReviewComment {
  id?: number;
  pull_request_review_id?: number;
  path?: string;
  position?: number;
  original_position?: number;
  body?: string;
  user?: { login?: string } | null;
  resolver?: { login?: string } | null;
  html_url?: string;
  created_at?: string;
}

// Gitea lists line comments per review, so this reads the reviews and then the comments
// of each review that has some. Paging stops at an empty page, since an instance can set
// a page size below the one asked for, and after MAX_PAGES, so a server that keeps
// answering full pages cannot hold the run in this loop. ponytail: up to 1000 reviews and
// one call per review; page the tool itself if longer review histories turn up.
export const giteaListReviewComments: CustomToolEntry = {
  key: 'gitea_list_review_comments',
  group: 'Pull requests',
  label: 'Gitea List Review Comments',
  description:
    'List the comments on lines of a Gitea or Forgejo pull request diff, from every review, with whether their conversation is resolved. Comments on the same path and line form one conversation. Returns each comment with its id, which gitea_reply_review_comment and gitea_resolve_review_comment take.',
  inputSchema: z.object({ ...repoInput, pull: pullInput }),
  execute: async (credential, input) => {
    const base = `${repoPath(input.owner, input.repo)}/pulls/${numberRef(input.pull)}/reviews`;
    const reviews: Review[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await giteaRequest<Review[]>(
        credential,
        'GET',
        `${base}?limit=${PAGE}&page=${page}`,
      );
      reviews.push(...batch);
      if (batch.length === 0) break;
    }
    const comments: ReviewComment[] = [];
    for (const review of reviews) {
      if (!review.comments_count) continue;
      comments.push(
        ...(await giteaRequest<ReviewComment[]>(
          credential,
          'GET',
          `${base}/${review.id}/comments`,
        )),
      );
    }
    return {
      comments: comments.map((c) => ({
        id: c.id,
        reviewId: c.pull_request_review_id ?? null,
        path: c.path ?? '',
        newLine: c.position || null,
        oldLine: c.original_position || null,
        author: c.user?.login ?? null,
        body: c.body ?? '',
        resolved: Boolean(c.resolver),
        createdAt: c.created_at ?? null,
        url: c.html_url ?? null,
      })),
    };
  },
};
