import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import {
  gitlabRequest,
  mergeRequestInput,
  mergeRequestRef,
  projectInput,
  projectPath,
} from './client';

interface Note {
  id: number;
  body?: string;
  system?: boolean;
  resolvable?: boolean;
  resolved?: boolean;
  author?: { username?: string } | null;
  created_at?: string;
  position?: {
    new_path?: string;
    old_path?: string;
    new_line?: number | null;
    old_line?: number | null;
  } | null;
}

// GitLab lists system notes, such as "added 1 commit", as discussions of their own; they
// are left out. A page can then hold fewer threads than were asked for, so the next page
// is read off the number of discussions GitLab sent.
export const gitlabListMergeRequestThreads: CustomToolEntry = {
  key: 'gitlab_list_merge_request_threads',
  group: 'Merge requests',
  label: 'GitLab List Merge Request Threads',
  description:
    'List the comment threads of a GitLab merge request: the comments on lines of its diff and on the merge request itself, with whether each thread is resolved. Returns each thread with its id, which gitlab_reply_merge_request_thread and gitlab_resolve_merge_request_thread take. Returns nextPage when there are more threads to read; pass it as page.',
  inputSchema: z.object({
    project: projectInput,
    mergeRequest: mergeRequestInput,
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('How many discussions to read per page, 1-100 (default 20).'),
    page: z.number().int().min(1).optional().describe('Page number (default 1).'),
  }),
  execute: async (credential, input) => {
    const limit = Number(input.limit ?? 20);
    const page = Number(input.page ?? 1);
    const query = new URLSearchParams({ per_page: String(limit), page: String(page) });
    const discussions = await gitlabRequest<{ id: string; notes?: Note[] }[]>(
      credential,
      'GET',
      `${projectPath(input.project)}/merge_requests/${mergeRequestRef(input.mergeRequest)}/discussions?${query}`,
    );
    return {
      threads: discussions
        .map((d) => ({ id: d.id, notes: (d.notes ?? []).filter((n) => !n.system) }))
        .filter((d) => d.notes.length > 0)
        .map(({ id, notes }) => {
          const resolvable = notes.filter((n) => n.resolvable);
          const position = notes[0]?.position;
          return {
            id,
            resolvable: resolvable.length > 0,
            resolved: resolvable.length > 0 && resolvable.every((n) => n.resolved),
            path: position?.new_path ?? null,
            newLine: position?.new_line ?? null,
            oldLine: position?.old_line ?? null,
            notes: notes.map((n) => ({
              id: n.id,
              author: n.author?.username ?? null,
              body: n.body ?? '',
              createdAt: n.created_at ?? null,
            })),
          };
        }),
      nextPage: discussions.length === limit ? page + 1 : null,
    };
  },
};
