import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import {
  gitlabRequest,
  mergeRequestInput,
  mergeRequestRef,
  projectInput,
  projectPath,
} from './client';

interface GitlabDiff {
  old_path?: string;
  new_path?: string;
  diff?: string;
  new_file?: boolean;
  renamed_file?: boolean;
  deleted_file?: boolean;
  collapsed?: boolean;
  too_large?: boolean;
}

function status(file: GitlabDiff): string {
  if (file.new_file) return 'added';
  if (file.deleted_file) return 'deleted';
  if (file.renamed_file) return 'renamed';
  return 'modified';
}

export const gitlabListMergeRequestFiles: CustomToolEntry = {
  key: 'gitlab_list_merge_request_files',
  group: 'Merge requests',
  label: 'GitLab List Merge Request Files',
  description:
    'List the files a GitLab merge request changes, with the unified diff of each file. Read the line numbers for review comments from the @@ hunk headers. patch is null when GitLab leaves the diff out: for a binary file, or one over its diff limits (tooLarge).',
  inputSchema: z.object({
    project: projectInput,
    mergeRequest: mergeRequestInput,
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('How many files to return per page, 1-100 (default 30).'),
    page: z.number().int().min(1).optional().describe('Page number (default 1).'),
  }),
  execute: async (credential, input) => {
    const query = new URLSearchParams({
      per_page: String(input.limit ?? 30),
      page: String(input.page ?? 1),
    });
    const files = await gitlabRequest<GitlabDiff[]>(
      credential,
      'GET',
      `${projectPath(input.project)}/merge_requests/${mergeRequestRef(input.mergeRequest)}/diffs?${query}`,
    );
    return {
      files: files.map((file) => {
        const lines = file.diff ? file.diff.split('\n') : [];
        return {
          path: file.new_path ?? file.old_path ?? '',
          previousPath: file.renamed_file ? (file.old_path ?? null) : null,
          status: status(file),
          additions: lines.filter((line) => line.startsWith('+')).length,
          deletions: lines.filter((line) => line.startsWith('-')).length,
          patch: file.diff || null,
          tooLarge: Boolean(file.too_large || file.collapsed),
        };
      }),
    };
  },
};
