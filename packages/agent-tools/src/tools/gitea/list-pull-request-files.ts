import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { giteaDiff, numberRef, pullInput, repoInput, repoPath } from './client';
import { splitDiff } from './diff';

// The files endpoint carries no patches, so the files come from the pull request's
// diff. ponytail: each page downloads the whole diff; cache it per head commit if large
// pull requests make paging slow.
export const giteaListPullRequestFiles: CustomToolEntry = {
  key: 'gitea_list_pull_request_files',
  group: 'Pull requests',
  label: 'Gitea List Pull Request Files',
  description:
    'List the files a Gitea or Forgejo pull request changes, with the unified diff of each file. Read the line numbers for review comments from the @@ hunk headers. patch is null for a binary file.',
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
    const files = splitDiff(
      await giteaDiff(
        credential,
        `${repoPath(input.owner, input.repo)}/pulls/${numberRef(input.pull)}.diff`,
      ),
    );
    const limit = Number(input.limit ?? 30);
    const from = (Number(input.page ?? 1) - 1) * limit;
    return { files: files.slice(from, from + limit), totalFiles: files.length };
  },
};
