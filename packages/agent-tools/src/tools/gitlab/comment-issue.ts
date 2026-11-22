import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { gitlabRequest, issueInput, issueRef, projectInput, projectPath } from './client';

export const gitlabCommentIssue: CustomToolEntry = {
  key: 'gitlab_comment_issue',
  group: 'Issues',
  label: 'GitLab Comment Issue',
  description:
    'Comment on an issue in a GitLab project. The text is markdown. GitLab runs quick actions in it, such as /close or /label ~bug, and removes them from the saved comment. Returns the id of the new comment.',
  inputSchema: z.object({
    project: projectInput,
    issue: issueInput,
    body: z.string().min(1).describe('The comment text, as markdown.'),
  }),
  execute: async (credential, input) => {
    const note = await gitlabRequest<{ id?: number }>(
      credential,
      'POST',
      `${projectPath(input.project)}/issues/${issueRef(input.issue)}/notes`,
      { body: String(input.body) },
    );
    return { id: note.id ?? null };
  },
};
