import { Elysia, t } from 'elysia';
import { noContent } from '../shared/http';
import { guards } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { requireUser } from '../shared/access';
import { HttpError } from '../shared/lib';
import { mcpTool } from '../mcp/generate';
import { ErrorResponse } from '../shared/responses';
import {
  listNoteBoards,
  createNoteBoard,
  getNoteBoard,
  updateNoteBoard,
  deleteNoteBoard,
  type NoteBoardRow,
} from './store';

const boardParams = t.Object({ projectKey: t.String(), boardId: t.Numeric() });

// A note board DTO (NoteBoardRow from the store). canvas is a jsonb blob owned by
// the UI (React Flow nodes/edges) and returned verbatim, so it is typed t.Any().
const NoteBoardResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  ownerUserId: t.Nullable(t.String()),
  name: t.String(),
  canvas: t.Any(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

// The list/switcher DTO: the board without its canvas.
const NoteBoardSummaryResponse = t.Omit(NoteBoardResponse, ['canvas']);

// Load a board that belongs to this project and that the user may access: a
// public board (no owner) is open to any member; a personal board only to its
// owner. Anything else is a 404 so a personal board's existence does not leak.
async function loadAccessibleBoard(
  boardId: number,
  projectId: number,
  userId: string,
): Promise<NoteBoardRow> {
  const board = await getNoteBoard(boardId);
  if (!board || board.projectId !== projectId) throw new HttpError(404, 'Board not found');
  if (board.ownerUserId !== null && board.ownerUserId !== userId) {
    throw new HttpError(404, 'Board not found');
  }
  return board;
}

export const noteBoardRoutes = new Elysia({
  name: 'note-boards',
  detail: { tags: ['Note boards'] },
})
  .use(authContext)
  .use(guards)
  .get(
    '/projects/:projectKey/note-boards',
    async ({ project, user, query }) => {
      return listNoteBoards(project.id, requireUser(user).id, {
        q: query.q,
        limit: query.limit ?? 10,
        offset: query.offset ?? 0,
      });
    },
    {
      projectMember: true,
      // Paged for the board switcher: `q` filters by name, `limit`/`offset` page
      // the result. Canvas is omitted; open a board to load its canvas.
      query: t.Object({
        q: t.Optional(t.String()),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
        offset: t.Optional(t.Numeric({ minimum: 0 })),
      }),
      response: {
        200: t.Array(NoteBoardSummaryResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: "List a project's note boards", ...mcpTool('list_note_boards') },
    },
  )

  .get(
    '/projects/:projectKey/note-boards/:boardId',
    async ({ project, user, params }) => {
      return loadAccessibleBoard(params.boardId, project.id, requireUser(user).id);
    },
    {
      projectMember: true,
      params: boardParams,
      response: {
        200: NoteBoardResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Get a note board with its canvas', ...mcpTool('get_note_board') },
    },
  )

  .post(
    '/projects/:projectKey/note-boards',
    async ({ project, user, body, set }) => {
      const userId = requireUser(user).id;
      set.status = 201;
      return createNoteBoard({
        projectId: project.id,
        ownerUserId: body.personal ? userId : null,
        name: body.name,
        canvas: body.canvas,
      });
    },
    {
      projectMember: true,
      body: t.Object({
        name: t.String({ minLength: 1 }),
        // true creates a personal board owned by the caller; false/omitted a
        // public board visible to every member.
        personal: t.Optional(t.Boolean()),
        canvas: t.Optional(t.Any()),
      }),
      response: {
        201: NoteBoardResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Create a note board', ...mcpTool('create_note_board') },
    },
  )

  .patch(
    '/projects/:projectKey/note-boards/:boardId',
    async ({ project, user, params, body }) => {
      const userId = requireUser(user).id;
      await loadAccessibleBoard(params.boardId, project.id, userId);
      const patch: { name?: string; canvas?: unknown; ownerUserId?: string | null } = {};
      if (body.name !== undefined) patch.name = body.name;
      if (body.canvas !== undefined) patch.canvas = body.canvas;
      // personal true makes the board owned by (private to) the caller; false makes
      // it public. Only a user who can already access the board reaches here.
      if (body.personal !== undefined) patch.ownerUserId = body.personal ? userId : null;
      const board = await updateNoteBoard(params.boardId, patch);
      if (!board) throw new HttpError(404, 'Board not found');
      return board;
    },
    {
      projectMember: true,
      params: boardParams,
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        canvas: t.Optional(t.Any()),
        personal: t.Optional(t.Boolean()),
      }),
      response: {
        200: NoteBoardResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Update a note board', ...mcpTool('update_note_board') },
    },
  )

  .delete(
    '/projects/:projectKey/note-boards/:boardId',
    async ({ project, user, params }) => {
      await loadAccessibleBoard(params.boardId, project.id, requireUser(user).id);
      await deleteNoteBoard(params.boardId);
      return noContent();
    },
    {
      projectMember: true,
      params: boardParams,
      response: {
        204: t.Void(),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Delete a note board', ...mcpTool('delete_note_board') },
    },
  );
