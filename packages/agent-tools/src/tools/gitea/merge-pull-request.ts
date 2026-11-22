import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { giteaRequest, numberRef, pullInput, repoInput, repoPath } from './client';

// The capitalized field names are the ones Forgejo and Gitea before 28 read; Gitea 28
// reads them as well as the snake_case ones.
export const giteaMergePullRequest: CustomToolEntry = {
  key: 'gitea_merge_pull_request',
  group: 'Pull requests',
  label: 'Gitea Merge Pull Request',
  description:
    'Merge a Gitea or Forgejo pull request into its base branch. Pass sha, the head commit read with gitea_get_pull_request, so that commits pushed after the review are not merged. The server refuses the merge while required checks or approvals are missing or the branch has conflicts.',
  inputSchema: z.object({
    ...repoInput,
    pull: pullInput,
    method: z
      .enum(['merge', 'rebase', 'rebase-merge', 'squash', 'fast-forward-only'])
      .optional()
      .describe('How to merge (default merge). The repository may allow only some methods.'),
    title: z.string().optional().describe('Title of the merge or squash commit.'),
    message: z.string().optional().describe('Message of the merge or squash commit.'),
    sha: z.string().optional().describe('The head commit the pull request must still be at.'),
    deleteBranch: z.boolean().optional().describe('Delete the head branch after the merge.'),
  }),
  execute: async (credential, input) => {
    const number = numberRef(input.pull);
    await giteaRequest(
      credential,
      'POST',
      `${repoPath(input.owner, input.repo)}/pulls/${number}/merge`,
      {
        Do: input.method ?? 'merge',
        ...(input.title !== undefined ? { MergeTitleField: String(input.title) } : {}),
        ...(input.message !== undefined ? { MergeMessageField: String(input.message) } : {}),
        ...(input.sha !== undefined ? { head_commit_id: String(input.sha) } : {}),
        ...(input.deleteBranch !== undefined
          ? { delete_branch_after_merge: input.deleteBranch }
          : {}),
      },
    );
    return { number, merged: true };
  },
};
