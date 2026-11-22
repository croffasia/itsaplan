import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { giteaRequest, numberRef, pullInput, repoInput, repoPath, type GiteaPull } from './client';

export const giteaGetPullRequest: CustomToolEntry = {
  key: 'gitea_get_pull_request',
  group: 'Pull requests',
  label: 'Gitea Get Pull Request',
  description:
    'Read a pull request in a Gitea or Forgejo repository: its markdown body, state, branches, head commit and whether it can be merged.',
  inputSchema: z.object({ ...repoInput, pull: pullInput }),
  execute: async (credential, input) => {
    const pull = await giteaRequest<GiteaPull>(
      credential,
      'GET',
      `${repoPath(input.owner, input.repo)}/pulls/${numberRef(input.pull)}`,
    );
    return {
      number: pull.number,
      title: pull.title ?? '',
      body: pull.body ?? '',
      state: pull.state ?? null,
      draft: pull.draft ?? false,
      merged: pull.merged ?? false,
      mergeable: pull.mergeable ?? null,
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
