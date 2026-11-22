import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import {
  githubRequest,
  numberRef,
  pullInput,
  repoInput,
  repoPath,
  type GithubPull,
} from './client';

export const githubGetPullRequest: CustomToolEntry = {
  key: 'github_get_pull_request',
  group: 'Pull requests',
  label: 'GitHub Get Pull Request',
  description:
    'Read a pull request in a GitHub repository: its markdown body, state, branches, head commit and whether it can be merged. mergeable is null while GitHub is still computing it; read the pull request again a few seconds later.',
  inputSchema: z.object({ ...repoInput, pull: pullInput }),
  execute: async (credential, input) => {
    const pull = await githubRequest<GithubPull>(
      credential,
      'GET',
      `${repoPath(input.owner, input.repo)}/pulls/${numberRef(input.pull, 'pull request')}`,
    );
    return {
      number: pull.number,
      title: pull.title ?? '',
      body: pull.body ?? '',
      state: pull.state ?? null,
      draft: pull.draft ?? false,
      merged: pull.merged ?? false,
      mergeable: pull.mergeable ?? null,
      mergeableState: pull.mergeable_state ?? null,
      author: pull.user?.login ?? null,
      headBranch: pull.head?.ref ?? null,
      headSha: pull.head?.sha ?? null,
      baseBranch: pull.base?.ref ?? null,
      additions: pull.additions ?? null,
      deletions: pull.deletions ?? null,
      changedFiles: pull.changed_files ?? null,
      url: pull.html_url ?? null,
    };
  },
};
