import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { githubRequest, numberRef, pullInput, repoInput, repoPath } from './client';

const EVENTS = { approve: 'APPROVE', request_changes: 'REQUEST_CHANGES', comment: 'COMMENT' };

// A comment goes on the right side of the diff at its new line, or on the left side at
// its old line when it has only that, which is a removed line.
export const githubReviewPullRequest: CustomToolEntry = {
  key: 'github_review_pull_request',
  group: 'Pull requests',
  label: 'GitHub Review Pull Request',
  description:
    'Submit a review of a GitHub pull request: approve it, request changes, or only comment. The review can carry comments on lines of the diff; take the line numbers from github_list_pull_request_files. A body is required to request changes or to comment. GitHub does not let anyone approve or request changes on their own pull request.',
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
    const event = input.event as keyof typeof EVENTS;
    const body = input.body === undefined ? '' : String(input.body);
    if (event !== 'approve' && !body.trim()) {
      throw new Error('Give a body to request changes or to comment.');
    }
    const comments = ((input.comments ?? []) as Record<string, unknown>[]).map((c) => {
      if (c.newLine === undefined && c.oldLine === undefined) {
        throw new Error(`Give newLine or oldLine for the comment on ${String(c.path)}.`);
      }
      return {
        path: String(c.path),
        body: String(c.body),
        ...(c.newLine !== undefined
          ? { line: c.newLine, side: 'RIGHT' }
          : { line: c.oldLine, side: 'LEFT' }),
      };
    });
    const review = await githubRequest<{ id?: number; state?: string; html_url?: string }>(
      credential,
      'POST',
      `${repoPath(input.owner, input.repo)}/pulls/${numberRef(input.pull, 'pull request')}/reviews`,
      {
        event: EVENTS[event],
        ...(body ? { body } : {}),
        ...(comments.length ? { comments } : {}),
      },
    );
    return { id: review.id ?? null, state: review.state ?? null, url: review.html_url ?? null };
  },
};
