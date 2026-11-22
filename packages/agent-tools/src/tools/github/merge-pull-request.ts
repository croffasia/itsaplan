import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { githubRequest, numberRef, pullInput, repoInput, repoPath } from './client';

// The asynchronous merge endpoint, which also takes merge queues, is unknown to
// Enterprise Server and answers before the merge is done, so this call merges directly.
export const githubMergePullRequest: CustomToolEntry = {
  key: 'github_merge_pull_request',
  group: 'Pull requests',
  label: 'GitHub Merge Pull Request',
  description:
    'Merge a GitHub pull request into its base branch. Pass sha, the head commit read with github_get_pull_request, so that commits pushed after the review are not merged. GitHub refuses the merge while required checks or reviews are missing or the branch has conflicts.',
  inputSchema: z.object({
    ...repoInput,
    pull: pullInput,
    method: z
      .enum(['merge', 'squash', 'rebase'])
      .optional()
      .describe('How to merge (default merge). The repository may allow only some methods.'),
    title: z.string().optional().describe('Title of the merge or squash commit.'),
    message: z.string().optional().describe('Message of the merge or squash commit.'),
    sha: z.string().optional().describe('The head commit the pull request must still be at.'),
  }),
  execute: async (credential, input) => {
    const result = await githubRequest<{ merged?: boolean; sha?: string; message?: string }>(
      credential,
      'PUT',
      `${repoPath(input.owner, input.repo)}/pulls/${numberRef(input.pull, 'pull request')}/merge`,
      {
        ...(input.method !== undefined ? { merge_method: input.method } : {}),
        ...(input.title !== undefined ? { commit_title: String(input.title) } : {}),
        ...(input.message !== undefined ? { commit_message: String(input.message) } : {}),
        ...(input.sha !== undefined ? { sha: String(input.sha) } : {}),
      },
    );
    return {
      merged: result.merged ?? false,
      sha: result.sha ?? null,
      message: result.message ?? null,
    };
  },
};
