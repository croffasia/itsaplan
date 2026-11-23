import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import {
  gitlabRequest,
  stateOf,
  projectInput,
  projectPath,
  STATES,
  type GitlabIssue,
} from './client';

export const gitlabListIssues: CustomToolEntry = {
  key: 'gitlab_list_issues',
  group: 'Issues',
  label: 'GitLab List Issues',
  description:
    'List issues in a GitLab project, most recently created first. Returns each issue with its number, which the other GitLab tools take.',
  inputSchema: z.object({
    project: projectInput,
    state: z.enum(['open', 'closed', 'all']).optional().describe('Filter by state (default open).'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('How many issues to return per page, 1-50 (default 10).'),
    page: z.number().int().min(1).optional().describe('Page number (default 1).'),
  }),
  execute: async (credential, input) => {
    const query = new URLSearchParams({
      state: STATES[(input.state as keyof typeof STATES | undefined) ?? 'open'],
      per_page: String(input.limit ?? 10),
      page: String(input.page ?? 1),
    });
    const issues = await gitlabRequest<GitlabIssue[]>(
      credential,
      'GET',
      `${projectPath(input.project)}/issues?${query}`,
    );
    return {
      issues: issues.map((issue) => ({
        number: issue.iid,
        title: issue.title ?? '',
        state: stateOf(issue),
        url: issue.web_url ?? null,
        updatedAt: issue.updated_at ?? null,
        labels: issue.labels ?? [],
      })),
    };
  },
};
