import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { giteaRequest, numberRef, pullInput, repoInput, repoPath } from './client';

const EVENTS = { approve: 'APPROVED', request_changes: 'REQUEST_CHANGES', comment: 'COMMENT' };

// Gitea puts a comment on the old side as soon as old_position is set, so a comment with
// a new line sends only that.
export const giteaReviewPullRequest: CustomToolEntry = {
  key: 'gitea_review_pull_request',
  group: 'Pull requests',
  label: 'Gitea Review Pull Request',
  description:
    'Submit a review of a Gitea or Forgejo pull request: approve it, request changes, or only comment. The review can carry comments on lines of the diff; take the line numbers from gitea_list_pull_request_files. A body is required to request changes. Nobody can approve or request changes on their own pull request.',
  inputSchema: z.object({
    ...repoInput,
    pull: pullInput,
    event: z.enum(['approve', 'request_changes', 'comment']).describe('What the review does.'),
    body: z.string().optional().describe('The review summary, as markdown.'),
    comments: z
      .array(
        z.object({
          path: z.string().min(1).describe('Path of the file, as the file list gives it.'),
          newLine: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe(
              'Line number in the new version of the file, for an added or unchanged line.',
            ),
          oldLine: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe('Line number in the old version of the file, for a removed line.'),
          body: z.string().min(1).describe('The comment text, as markdown.'),
        }),
      )
      .optional()
      .describe('Comments on lines of the diff.'),
  }),
  execute: async (credential, input) => {
    const comments = ((input.comments ?? []) as Record<string, unknown>[]).map((c) => {
      if (c.newLine === undefined && c.oldLine === undefined) {
        throw new Error(`Give newLine or oldLine for the comment on ${String(c.path)}.`);
      }
      return {
        path: String(c.path),
        body: String(c.body),
        ...(c.newLine !== undefined ? { new_position: c.newLine } : { old_position: c.oldLine }),
      };
    });
    const review = await giteaRequest<{ id?: number; state?: string; html_url?: string }>(
      credential,
      'POST',
      `${repoPath(input.owner, input.repo)}/pulls/${numberRef(input.pull)}/reviews`,
      {
        event: EVENTS[input.event as keyof typeof EVENTS],
        ...(input.body !== undefined ? { body: String(input.body) } : {}),
        ...(comments.length ? { comments } : {}),
      },
    );
    return { id: review.id ?? null, state: review.state ?? null, url: review.html_url ?? null };
  },
};
