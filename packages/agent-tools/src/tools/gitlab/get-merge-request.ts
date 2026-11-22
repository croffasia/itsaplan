import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import {
  gitlabRequest,
  mergeRequestInput,
  mergeRequestRef,
  projectInput,
  projectPath,
  stateOf,
  type GitlabMergeRequest,
} from './client';

export const gitlabGetMergeRequest: CustomToolEntry = {
  key: 'gitlab_get_merge_request',
  group: 'Merge requests',
  label: 'GitLab Get Merge Request',
  description:
    'Read a merge request in a GitLab project: its markdown description, state, branches, head commit and merge status. mergeStatus is "mergeable" when it can be merged; otherwise it names what blocks the merge, such as not_approved, ci_must_pass, discussions_not_resolved, conflict or draft_status. It is "checking" or "unchecked" while GitLab is still computing it; read the merge request again a few seconds later.',
  inputSchema: z.object({ project: projectInput, mergeRequest: mergeRequestInput }),
  execute: async (credential, input) => {
    const mr = await gitlabRequest<GitlabMergeRequest>(
      credential,
      'GET',
      `${projectPath(input.project)}/merge_requests/${mergeRequestRef(input.mergeRequest)}`,
    );
    return {
      number: mr.iid,
      title: mr.title ?? '',
      body: mr.description ?? '',
      state: stateOf(mr),
      draft: mr.draft ?? false,
      mergeStatus: mr.detailed_merge_status ?? null,
      hasConflicts: mr.has_conflicts ?? false,
      author: mr.author?.username ?? null,
      sourceBranch: mr.source_branch ?? null,
      targetBranch: mr.target_branch ?? null,
      headSha: mr.sha ?? null,
      changesCount: mr.changes_count ?? null,
      url: mr.web_url ?? null,
    };
  },
};
