import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { githubRequest, numberRef, pullInput, repoInput, repoPath } from './client';

interface GithubFile {
  filename?: string;
  previous_filename?: string;
  status?: string;
  additions?: number;
  deletions?: number;
  patch?: string;
}

// GitHub lists at most 3000 files of a pull request, and leaves out the patch of a
// binary file and of a diff too large to show.
export const githubListPullRequestFiles: CustomToolEntry = {
  key: 'github_list_pull_request_files',
  group: 'Pull requests',
  label: 'GitHub List Pull Request Files',
  description:
    'List the files a GitHub pull request changes, with the unified diff of each file. Read the line numbers for review comments from the @@ hunk headers. patch is null for a binary file and for a diff too large to show.',
  inputSchema: z.object({
    ...repoInput,
    pull: pullInput,
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
    const files = await githubRequest<GithubFile[]>(
      credential,
      'GET',
      `${repoPath(input.owner, input.repo)}/pulls/${numberRef(input.pull, 'pull request')}/files?${query}`,
    );
    return {
      files: files.map((file) => ({
        path: file.filename ?? '',
        previousPath: file.previous_filename ?? null,
        status: file.status ?? null,
        additions: file.additions ?? 0,
        deletions: file.deletions ?? 0,
        patch: file.patch ?? null,
      })),
    };
  },
};
