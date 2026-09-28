import { t } from 'elysia';
import { pageResponse } from '#shared/pagination';

export const workspaceSearchQuery = t.Object({
  q: t.String({
    minLength: 1,
    maxLength: 200,
    pattern: '\\S',
    description:
      'Search terms, a project name/key, or an issue identifier such as KEY-42. Every whitespace-separated term must match; order and case do not matter.',
  }),
  kind: t.Optional(
    t.UnionEnum(['all', 'projects', 'issues'], {
      description: 'Search projects (task boards), issues (tasks), or both. Default all.',
    }),
  ),
  projectKey: t.Optional(
    t.String({
      minLength: 1,
      description: "Restrict to this project, by its key or its ref '<team>.KEY'.",
    }),
  ),
  teamId: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  page: t.Optional(
    t.Numeric({ minimum: 1, multipleOf: 1, description: '1-based page. Default 1.' }),
  ),
  pageSize: t.Optional(
    t.Numeric({
      minimum: 1,
      maximum: 50,
      multipleOf: 1,
      description: 'Results per page. Default 25, maximum 50.',
    }),
  ),
});

const projectReference = {
  projectKey: t.String(),
  projectRef: t.String({
    description: "'<team>.KEY': names the project in any {projectKey} argument.",
  }),
  projectName: t.String(),
  teamId: t.Number(),
};

export const WorkspaceSearchResponse = pageResponse(
  t.Union([
    t.Object({
      kind: t.Literal('project'),
      id: t.Number(),
      title: t.String(),
      ...projectReference,
    }),
    t.Object({
      kind: t.Literal('issue'),
      id: t.Number(),
      title: t.String(),
      ...projectReference,
      identifier: t.String(),
      columnId: t.Number(),
      columnName: t.String(),
      stateType: t.String(),
      archived: t.Boolean(),
    }),
  ]),
);
