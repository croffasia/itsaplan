import { Elysia, t } from 'elysia';
import { mcpTool } from '../mcp/generate';
import { noContent } from '../shared/http';
import { authContext } from '../shared/auth-context';
import { guards } from '../shared/guards';
import { requireUser } from '../shared/access';
import { HttpError } from '../shared/lib';
import { commonErrors } from '../shared/responses';
import { listColumns, createColumn, updateColumn, reorderColumns, deleteColumn } from './store';

const stateType = t.Union([
  t.Literal('backlog'),
  t.Literal('unstarted'),
  t.Literal('started'),
  t.Literal('completed'),
  t.Literal('canceled'),
]);

const columnParams = t.Object({ projectKey: t.String(), columnId: t.Numeric() });

// A column DTO (ColumnRow from the store).
const ColumnResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  stateType: t.String(),
  color: t.String(),
  position: t.Number(),
});

export const columnRoutes = new Elysia({ name: 'columns', detail: { tags: ['Columns'] } })
  .use(authContext)
  .use(guards)
  .post(
    '/projects/:projectKey/columns',
    async ({ project, body, set }) => {
      set.status = 201;
      return createColumn({ projectId: project.id, ...body });
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        stateType,
        color: t.Optional(t.String()),
      }),
      permission: ['states', 'create'],
      response: { 201: ColumnResponse, ...commonErrors },
      detail: {
        summary: 'Create a column',
        description:
          'Create a column (workflow state). stateType is one of ' +
          'backlog/unstarted/started/completed/canceled.',
        ...mcpTool('create_column'),
      },
    },
  )

  // Reorders the project's columns. Body carries the full desired left-to-right
  // order of column ids; the store renumbers positions to match.
  .put(
    '/projects/:projectKey/columns/reorder',
    async ({ project, body }) => {
      await reorderColumns(project.id, body.orderedIds);
      return listColumns(project.id);
    },
    {
      body: t.Object({ orderedIds: t.Array(t.Integer(), { minItems: 1 }) }),
      permission: ['states', 'edit'],
      response: { 200: t.Array(ColumnResponse), ...commonErrors },
      detail: {
        summary: 'Reorder columns',
        description:
          "Reorder a project's columns. orderedIds is the full left-to-right list of " +
          'column ids. Returns the reordered columns.',
        ...mcpTool('reorder_columns'),
      },
    },
  )

  .patch(
    '/projects/:projectKey/columns/:columnId',
    async ({ params, project, body }) => {
      const column = await updateColumn(params.columnId, project.id, body);
      if (!column) throw new HttpError(404, 'Column not found');
      return column;
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        stateType: t.Optional(stateType),
        color: t.Optional(t.String()),
      }),
      params: columnParams,
      permission: ['states', 'edit'],
      response: { 200: ColumnResponse, ...commonErrors },
      detail: {
        summary: 'Update a column',
        description: "Update a column's name, stateType, or color.",
        ...mcpTool('update_column'),
      },
    },
  )

  // Deletes a column. Body picks what happens to its issues: mode 'move' reassigns
  // them to targetColumnId, mode 'delete' removes them. Backlog columns are
  // rejected by the store layer.
  .delete(
    '/projects/:projectKey/columns/:columnId',
    async ({ params, project, body, user }) => {
      await deleteColumn(params.columnId, project.id, body, requireUser(user).id);
      return noContent();
    },
    {
      body: t.Union([
        t.Object({ mode: t.Literal('move'), targetColumnId: t.Integer() }),
        t.Object({ mode: t.Literal('delete') }),
      ]),
      params: columnParams,
      permission: ['states', 'delete'],
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete a column',
        description:
          "Delete a column. Body mode 'move' reassigns its issues to targetColumnId, " +
          "'delete' removes them. Backlog columns cannot be deleted.",
        ...mcpTool('delete_column'),
      },
    },
  );
