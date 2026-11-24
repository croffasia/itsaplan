import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import {
  gitlabRequest,
  issueInput,
  issueRef,
  stateOf,
  projectInput,
  projectPath,
  type GitlabIssue,
} from './client';

export const gitlabUpdateIssue: CustomToolEntry = {
  key: 'gitlab_update_issue',
  group: 'Issues',
  label: 'GitLab Update Issue',
  description:
    'Update an issue in a GitLab project: change its title or markdown body, or close and reopen it. Give at least one of title, body or state.',
  inputSchema: z.object({
    project: projectInput,
    issue: issueInput,
    title: z.string().min(1).optional().describe('New title.'),
    body: z.string().optional().describe('New description, as markdown.'),
    state: z
      .enum(['open', 'closed'])
      .optional()
      .describe('closed closes the issue, open reopens it.'),
  }),
  execute: async (credential, input) => {
    if (input.title === undefined && input.body === undefined && input.state === undefined) {
      throw new Error('Give at least one of title, body or state to update.');
    }
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = String(input.title);
    if (input.body !== undefined) patch.description = String(input.body);
    if (input.state !== undefined)
      patch.state_event = input.state === 'closed' ? 'close' : 'reopen';
    const issue = await gitlabRequest<GitlabIssue>(
      credential,
      'PUT',
      `${projectPath(input.project)}/issues/${issueRef(input.issue)}`,
      patch,
    );
    return {
      number: issue.iid,
      state: stateOf(issue),
      url: issue.web_url ?? null,
    };
  },
};
