import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { gitlabRequest, stateOf, projectInput, projectPath, type GitlabIssue } from './client';

export const gitlabCreateIssue: CustomToolEntry = {
  key: 'gitlab_create_issue',
  group: 'Issues',
  label: 'GitLab Create Issue',
  description:
    'Create an issue in a GitLab project. The body is markdown. Returns the new issue with its number, which the other GitLab tools take.',
  inputSchema: z.object({
    project: projectInput,
    title: z.string().min(1).describe('Issue title.'),
    body: z.string().optional().describe('Issue description, as markdown.'),
  }),
  execute: async (credential, input) => {
    const issue = await gitlabRequest<GitlabIssue>(
      credential,
      'POST',
      `${projectPath(input.project)}/issues`,
      {
        title: String(input.title),
        ...(input.body !== undefined ? { description: String(input.body) } : {}),
      },
    );
    return {
      number: issue.iid,
      title: issue.title ?? null,
      state: stateOf(issue),
      url: issue.web_url ?? null,
    };
  },
};
