import { z } from 'zod';
import type { CustomToolEntry, ToolConfig } from '../../types';
import {
  gitlabRequest,
  mergeRequestInput,
  mergeRequestRef,
  projectInput,
  projectPath,
  type GitlabMergeRequest,
} from './client';

const REVIEWER_STATES = { request_changes: 'requested_changes', comment: 'reviewed' } as const;

interface LineComment {
  path: string;
  oldPath?: string;
  newLine?: number;
  oldLine?: number;
  body: string;
}

// The commits a diff comment is placed against: those of the latest diff version.
async function diffRefs(credential: ToolConfig, mr: string) {
  const refs = (await gitlabRequest<GitlabMergeRequest>(credential, 'GET', mr)).diff_refs;
  if (!refs?.head_sha) {
    throw new Error(
      'GitLab has not prepared the diff of this merge request yet. Try again in a few seconds.',
    );
  }
  return { base_sha: refs.base_sha, start_sha: refs.start_sha, head_sha: refs.head_sha };
}

// The summary and the comments are draft notes until bulk_publish posts them together,
// as the review form in GitLab does. The summary is a draft rather than the note of
// bulk_publish, which GitLab before 19.2 ignores. bulk_publish posts every draft of the
// token's account on the merge request, so a review starts only when there are none.
async function publishReview(
  credential: ToolConfig,
  mr: string,
  event: 'approve' | 'request_changes' | 'comment',
  body: string,
  comments: LineComment[],
): Promise<void> {
  const pending = await gitlabRequest<unknown[]>(credential, 'GET', `${mr}/draft_notes`);
  if (pending.length > 0) {
    throw new Error(
      'The account of the GitLab token has unpublished draft comments on this merge request. Publish or delete them in GitLab first: the review would publish them too.',
    );
  }
  const refs = comments.length > 0 ? await diffRefs(credential, mr) : null;
  const drafts: number[] = [];
  const draft = async (fields: Record<string, unknown>) => {
    const created = await gitlabRequest<{ id: number }>(
      credential,
      'POST',
      `${mr}/draft_notes`,
      fields,
    );
    drafts.push(created.id);
  };
  try {
    if (body) await draft({ note: body });
    for (const c of comments) {
      await draft({
        note: c.body,
        position: {
          position_type: 'text',
          ...refs,
          new_path: c.path,
          old_path: c.oldPath ?? c.path,
          ...(c.newLine !== undefined ? { new_line: c.newLine } : {}),
          ...(c.oldLine !== undefined ? { old_line: c.oldLine } : {}),
        },
      });
    }
    await gitlabRequest(
      credential,
      'POST',
      `${mr}/draft_notes/bulk_publish`,
      event !== 'approve' ? { reviewer_state: REVIEWER_STATES[event] } : {},
    );
  } catch (err) {
    // A draft left behind would go out with the account's next review.
    await Promise.allSettled(
      drafts.map((id) => gitlabRequest(credential, 'DELETE', `${mr}/draft_notes/${id}`)),
    );
    throw err;
  }
}

export const gitlabReviewMergeRequest: CustomToolEntry = {
  key: 'gitlab_review_merge_request',
  group: 'Merge requests',
  label: 'GitLab Review Merge Request',
  description:
    'Submit a review of a GitLab merge request: approve it, request changes, or only comment. The review can carry comments on lines of the diff; take the line numbers from gitlab_list_merge_request_files. Approving needs the account to be an eligible approver. Requesting changes needs GitLab 19.2 or newer; an older GitLab posts the comments without blocking the merge.',
  inputSchema: z.object({
    project: projectInput,
    mergeRequest: mergeRequestInput,
    event: z.enum(['approve', 'request_changes', 'comment']).describe('What the review does.'),
    body: z.string().optional().describe('The review summary, as markdown.'),
    comments: z
      .array(
        z.object({
          path: z.string().min(1).describe('Path of the file, as the file list gives it.'),
          oldPath: z
            .string()
            .optional()
            .describe('For a renamed file, its path before the change (previousPath).'),
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
            .describe(
              'Line number in the old version of the file, for a removed line. An unchanged line needs both numbers.',
            ),
          body: z.string().min(1).describe('The comment text, as markdown.'),
        }),
      )
      .optional()
      .describe('Comments on lines of the diff.'),
  }),
  execute: async (credential, input) => {
    const mr = `${projectPath(input.project)}/merge_requests/${mergeRequestRef(input.mergeRequest)}`;
    const event = input.event as 'approve' | 'request_changes' | 'comment';
    const body = input.body === undefined ? '' : String(input.body).trim();
    const comments = (input.comments ?? []) as LineComment[];
    for (const c of comments) {
      if (c.newLine === undefined && c.oldLine === undefined) {
        throw new Error(`Give newLine or oldLine for the comment on ${c.path}.`);
      }
    }
    if (event !== 'approve' || body || comments.length > 0) {
      await publishReview(credential, mr, event, body, comments);
    }
    if (event === 'approve') await gitlabRequest(credential, 'POST', `${mr}/approve`);
    return { event, comments: comments.length };
  },
};
