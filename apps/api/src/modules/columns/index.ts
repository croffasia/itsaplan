import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { noContent } from '#shared/http';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { commonErrors } from '#shared/responses';
import {
  ColumnListResponse,
  ColumnResponse,
  columnParams,
  createColumnBody,
  deleteColumnBody,
  reorderColumnsBody,
  updateColumnBody,
} from './model';
import { listColumns, createColumn, updateColumn, reorderColumns, deleteColumn } from './service';

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
      body: createColumnBody,
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

  .put(
    '/projects/:projectKey/columns/reorder',
    async ({ project, body }) => {
      await reorderColumns(project.id, body.orderedIds);
      return listColumns(project.id);
    },
    {
      body: reorderColumnsBody,
      permission: ['states', 'edit'],
      response: { 200: ColumnListResponse, ...commonErrors },
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
      body: updateColumnBody,
      params: columnParams,
      permission: ['states', 'edit'],
      response: { 200: ColumnResponse, ...commonErrors },
      detail: {
        summary: 'Update a column',
        description:
          "Update a column's name, stateType, color, its WIP limit " +
          '(wipLimit / wipMode), or its auto-assignee (autoAssignUserId).',
        ...mcpTool('update_column'),
      },
    },
  )

  .delete(
    '/projects/:projectKey/columns/:columnId',
    async ({ params, project, body, user }) => {
      await deleteColumn(params.columnId, project.id, body, requireUser(user).id);
      return noContent();
    },
    {
      body: deleteColumnBody,
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
