import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import {
  gitlabRequest,
  mergeRequestInput,
  mergeRequestRef,
  projectInput,
  projectPath,
} from './client';

export const gitlabCommentMergeRequest: CustomToolEntry = {
  key: 'gitlab_comment_merge_request',
  group: 'Merge requests',
  label: 'GitLab Comment Merge Request',
  description:
    'Comment on a GitLab merge request. The text is markdown. GitLab runs quick actions in it, such as /approve or /label ~bug, and removes them from the saved comment. Returns the id of the new comment.',
  inputSchema: z.object({
    project: projectInput,
    mergeRequest: mergeRequestInput,
    body: z.string().min(1).describe('The comment text, as markdown.'),
  }),
  execute: async (credential, input) => {
    const note = await gitlabRequest<{ id?: number }>(
      credential,
      'POST',
      `${projectPath(input.project)}/merge_requests/${mergeRequestRef(input.mergeRequest)}/notes`,
      { body: String(input.body) },
    );
    return { id: note.id ?? null };
  },
};
