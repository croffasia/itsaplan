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
      // Paged for the board switcher.
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
      detail: {
        summary: "List a project's note boards",
        description:
          "The boards the caller can see: the project's public boards plus the caller's own personal ones. `q` filters by name; `limit` (10 by default, 50 at most) and `offset` page the result. Cards are omitted — read a board to get them.",
        ...mcpTool('list_note_boards'),
      },
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
      detail: {
        summary: 'Get a note board with its canvas',
        description:
          'One board with its `canvas`, a React Flow graph `{ nodes, edges }`. A card (sticker, note) is a node: `{ id, type: "sticker", position: { x, y }, width, height, data: { title, body, color } }`, where `body` is markdown and `color` a hex string. A connection between two cards is an edge: `{ id, source, target }` of node ids. Cards exist only inside the canvas.',
        ...mcpTool('get_note_board'),
      },
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
      detail: {
        summary: 'Create a note board',
        description:
          'Create a board. `personal` true makes it private to the caller, otherwise every project member sees it. Cards go in `canvas` as nodes (see `get_note_board`); a card `body` is markdown and `color` a hex string such as `#FFF9B1`.',
        ...mcpTool('create_note_board'),
      },
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
      // Only a user who can already access the board reaches here, so switching it to
      // personal hands it to the caller.
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
      detail: {
        summary: 'Update a note board',
        description:
          'Rename a board, switch it between personal and public, or replace its `canvas`. Adding, editing, connecting, or deleting a card is a change to `canvas` (see `get_note_board`). It is replaced as a whole: read the board first, then send every node and edge that must stay — anything left out is deleted.',
        ...mcpTool('update_note_board'),
      },
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
      detail: {
        summary: 'Delete a note board',
        description: 'Permanently delete a note board and every note on it.',
        ...mcpTool('delete_note_board'),
      },
    },
  );
