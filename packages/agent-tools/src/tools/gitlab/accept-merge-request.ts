import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import {
  GitlabError,
  gitlabRequest,
  MOVED,
  mergeRequestInput,
  mergeRequestRef,
  projectInput,
  projectPath,
  stateOf,
  type GitlabMergeRequest,
} from './client';

interface Merged extends GitlabMergeRequest {
  merge_commit_sha?: string | null;
  squash_commit_sha?: string | null;
}

export const gitlabAcceptMergeRequest: CustomToolEntry = {
  key: 'gitlab_accept_merge_request',
  group: 'Merge requests',
  label: 'GitLab Accept Merge Request',
  description:
    'Merge a GitLab merge request into its target branch. Pass sha, the head commit read with gitlab_get_merge_request, so that commits pushed after the review are not merged; some instances require it. GitLab refuses the merge while its mergeStatus is not "mergeable".',
  inputSchema: z.object({
    project: projectInput,
    mergeRequest: mergeRequestInput,
    squash: z.boolean().optional().describe('Squash the commits into one on merge.'),
    message: z.string().optional().describe('Message of the merge commit.'),
    sha: z.string().optional().describe('The head commit the merge request must still be at.'),
    deleteBranch: z.boolean().optional().describe('Delete the source branch after the merge.'),
  }),
  execute: async (credential, input) => {
    let mr: Merged;
    try {
      mr = await gitlabRequest<Merged>(
        credential,
        'PUT',
        `${projectPath(input.project)}/merge_requests/${mergeRequestRef(input.mergeRequest)}/merge`,
        {
          ...(input.squash !== undefined ? { squash: input.squash } : {}),
          ...(input.message !== undefined ? { merge_commit_message: String(input.message) } : {}),
          ...(input.sha !== undefined ? { sha: String(input.sha) } : {}),
          ...(input.deleteBranch !== undefined
            ? { should_remove_source_branch: input.deleteBranch }
            : {}),
        },
      );
    } catch (err) {
      if (err instanceof GitlabError && err.status === 405 && err.message !== MOVED) {
        throw new Error(
          'GitLab cannot merge this merge request now. Read its mergeStatus with gitlab_get_merge_request to see what blocks it.',
        );
      }
      throw err;
    }
    return {
      number: mr.iid,
      state: stateOf(mr),
      mergeCommitSha: mr.merge_commit_sha ?? mr.squash_commit_sha ?? null,
      url: mr.web_url ?? null,
    };
  },
};
