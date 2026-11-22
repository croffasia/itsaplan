import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import {
  gitlabRequest,
  mergeRequestInput,
  mergeRequestRef,
  projectInput,
  projectPath,
} from './client';

export const gitlabReplyMergeRequestThread: CustomToolEntry = {
  key: 'gitlab_reply_merge_request_thread',
  group: 'Merge requests',
  label: 'GitLab Reply Merge Request Thread',
  description:
    'Reply in a comment thread of a GitLab merge request. The text is markdown; GitLab runs quick actions in it. Take the thread id from gitlab_list_merge_request_threads.',
  inputSchema: z.object({
    project: projectInput,
    mergeRequest: mergeRequestInput,
    thread: z.string().min(1).describe('Thread id from gitlab_list_merge_request_threads.'),
    body: z.string().min(1).describe('The reply text, as markdown.'),
  }),
  execute: async (credential, input) => {
    const note = await gitlabRequest<{ id?: number }>(
      credential,
      'POST',
      `${projectPath(input.project)}/merge_requests/${mergeRequestRef(input.mergeRequest)}/discussions/${encodeURIComponent(String(input.thread))}/notes`,
      { body: String(input.body) },
    );
    return { id: note.id ?? null };
  },
};
