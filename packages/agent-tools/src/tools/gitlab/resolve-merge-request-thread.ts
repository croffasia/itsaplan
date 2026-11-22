import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import {
  gitlabRequest,
  mergeRequestInput,
  mergeRequestRef,
  projectInput,
  projectPath,
} from './client';

export const gitlabResolveMergeRequestThread: CustomToolEntry = {
  key: 'gitlab_resolve_merge_request_thread',
  group: 'Merge requests',
  label: 'GitLab Resolve Merge Request Thread',
  description:
    'Resolve a comment thread of a GitLab merge request, or reopen it with resolved false. Take the thread id from gitlab_list_merge_request_threads. Needs the Developer role or higher, or authorship of the merge request.',
  inputSchema: z.object({
    project: projectInput,
    mergeRequest: mergeRequestInput,
    thread: z.string().min(1).describe('Thread id from gitlab_list_merge_request_threads.'),
    resolved: z.boolean().optional().describe('false reopens a resolved thread (default true).'),
  }),
  execute: async (credential, input) => {
    const resolved = input.resolved !== false;
    await gitlabRequest(
      credential,
      'PUT',
      `${projectPath(input.project)}/merge_requests/${mergeRequestRef(input.mergeRequest)}/discussions/${encodeURIComponent(String(input.thread))}`,
      { resolved },
    );
    return { id: String(input.thread), resolved };
  },
};
