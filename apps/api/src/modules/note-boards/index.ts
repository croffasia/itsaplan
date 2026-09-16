import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { requireUser } from '#shared/access';
import { getMembership } from '#modules/members/service';
import { HttpError } from '#shared/lib';
import { mcpTool } from '#mcp/generate';
import { accessErrors, commonErrors } from '#shared/responses';
import {
  NoteBoardAccessCandidateListResponse,
  NoteBoardResponse,
  NoteBoardSummaryListResponse,
  createNoteBoardBody,
  listNoteBoardsQuery,
  noteBoardParams,
  updateNoteBoardBody,
} from './model';
import {
  listNoteBoards,
  createNoteBoard,
  getNoteBoard,
  updateNoteBoard,
  deleteNoteBoard,
  listNoteBoardAccessCandidates,
  type NoteBoardRow,
} from './service';

// A public board is open to any member; a private one to its owner and the members
// granted access. Anything else is a 404 so a private board's existence does not
// leak.
function assertBoardVisible(board: NoteBoardRow, userId: string): void {
  if (
    board.ownerUserId !== null &&
    board.ownerUserId !== userId &&
    !board.memberIds.includes(userId)
  ) {
    throw new HttpError(404, 'Board not found');
  }
}

// Load a board that belongs to this project and that the user may access.
async function loadAccessibleBoard(
  boardId: number,
  projectId: number,
  userId: string,
): Promise<NoteBoardRow> {
  const board = await getNoteBoard(boardId);
  if (!board || board.projectId !== projectId) throw new HttpError(404, 'Board not found');
  assertBoardVisible(board, userId);
  return board;
}

// The members to grant access to: deduplicated, without the owner (who always has
// access), and rejected when someone cannot be granted it — they are not in the
// project, or their role cannot read note boards, which would make the grant do
// nothing since every board route checks that permission too.
async function grantedMembers(
  projectId: number,
  ownerUserId: string,
  userIds: string[],
): Promise<string[]> {
  const ids = [...new Set(userIds)].filter((id) => id !== ownerUserId);
  if (ids.length === 0) return [];
  const candidates = await listNoteBoardAccessCandidates(projectId);
  const grantable = new Set(candidates.filter((c) => c.canAccess).map((c) => c.userId));
  if (ids.some((id) => !grantable.has(id))) {
    throw new HttpError(400, 'Access can only be granted to project members who may read notes');
  }
  return ids;
}

export const noteBoardRoutes = new Elysia({
  name: 'note-boards',
  detail: { tags: ['Note boards'] },
})
  .use(authContext)
  .use(guards)
  .get(
    '/projects/:projectKey/note-boards',
    ({ project, user, query }) => listNoteBoards(project.id, requireUser(user).id, { q: query.q }),
    {
      permission: ['note_boards', 'read'],
      feature: 'notes',
      query: listNoteBoardsQuery,
      response: { 200: NoteBoardSummaryListResponse, ...accessErrors },
      detail: {
        summary: "List a project's note boards",
        description:
          "The boards the caller can see: the project's public boards, the caller's own private ones, and the boards they were granted access to, most recently updated first. `q` filters by name. Cards are omitted — read a board to get them.",
        ...mcpTool('list_note_boards'),
      },
    },
  )

  .get(
    '/projects/:projectKey/note-boards/access-candidates',
    async ({ project }) => listNoteBoardAccessCandidates(project.id),
    {
      permission: ['note_boards', 'edit'],
      feature: 'notes',
      response: { 200: NoteBoardAccessCandidateListResponse, ...accessErrors },
      detail: {
        summary: 'List who a board can be shared with',
        description:
          'The project members and agents a restricted board can grant access to. `canAccess` false means their role cannot read notes at all, so granting them access would change nothing and is rejected.',
      },
    },
  )

  .get(
    '/projects/:projectKey/note-boards/:boardId',
    async ({ project, user, params }) => {
      return loadAccessibleBoard(params.boardId, project.id, requireUser(user).id);
    },
    {
      permission: ['note_boards', 'read'],
      feature: 'notes',
      params: noteBoardParams,
      response: { 200: NoteBoardResponse, ...accessErrors },
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
        ownerUserId: body.visibility === 'private' ? userId : null,
        createdByUserId: userId,
        name: body.name,
        canvas: body.canvas,
      });
    },
    {
      permission: ['note_boards', 'create'],
      feature: 'notes',
      body: createNoteBoardBody,
      response: { 201: NoteBoardResponse, ...commonErrors },
      detail: {
        summary: 'Create a note board',
        description:
          'Create a board. `visibility` "private" keeps it to the caller, "public" (the default) shows it to every project member. Cards go in `canvas` as nodes (see `get_note_board`); a card `body` is markdown and `color` a hex string such as `#FFF9B1`.',
        ...mcpTool('create_note_board'),
      },
    },
  )

  .patch(
    '/projects/:projectKey/note-boards/:boardId',
    async ({ project, user, params, body }) => {
      const userId = requireUser(user).id;
      const current = await loadAccessibleBoard(params.boardId, project.id, userId);
      const patch: {
        name?: string;
        canvas?: unknown;
        ownerUserId?: string | null;
        memberIds?: string[];
      } = {};
      if (body.name !== undefined) patch.name = body.name;
      if (body.canvas !== undefined) patch.canvas = body.canvas;

      if (body.visibility !== undefined || body.memberIds !== undefined) {
        if (current.createdByUserId !== userId) {
          throw new HttpError(403, 'Only the board creator can change who sees the board');
        }
        const visibility = body.visibility ?? current.visibility;
        if (body.memberIds !== undefined && visibility !== 'restricted') {
          throw new HttpError(400, 'Members can only be granted access to a restricted board');
        }
        patch.ownerUserId = visibility === 'public' ? null : userId;
        if (visibility !== 'restricted') {
          // A public or private board grants no one: whoever was listed loses access.
          patch.memberIds = [];
        } else if (body.memberIds !== undefined) {
          patch.memberIds = await grantedMembers(project.id, userId, body.memberIds);
        }
      }

      const board = await updateNoteBoard(params.boardId, patch);
      if (!board) throw new HttpError(404, 'Board not found');
      return board;
    },
    {
      permission: ['note_boards', 'edit'],
      feature: 'notes',
      params: noteBoardParams,
      body: updateNoteBoardBody,
      response: { 200: NoteBoardResponse, ...commonErrors },
      detail: {
        summary: 'Update a note board',
        description:
          'Rename a board, change who sees it, or replace its `canvas`. `visibility` is "public" (every project member), "private" (the creator alone), or "restricted" (the creator plus the project members in `memberIds`, which replaces the granted list as a whole). Only the board creator can change either. Adding, editing, connecting, or deleting a card is a change to `canvas` (see `get_note_board`). It is replaced as a whole: read the board first, then send every node and edge that must stay — anything left out is deleted.',
        ...mcpTool('update_note_board', { destructiveHint: true }),
      },
    },
  )

  .delete(
    '/projects/:projectKey/note-boards/:boardId',
    async ({ project, user, params }) => {
      const userId = requireUser(user).id;
      const board = await getNoteBoard(params.boardId);
      if (!board || board.projectId !== project.id) throw new HttpError(404, 'Board not found');
      // A project owner deletes any board, a private one included: the board of a
      // member who left the project would otherwise stay for good.
      if ((await getMembership(project.id, userId)) !== 'owner') {
        assertBoardVisible(board, userId);
        // A private or restricted board belongs to the member who made it, and
        // being granted a view of one does not carry deleting it. A public board
        // stays open to every member the role matrix allows.
        if (board.ownerUserId !== null && board.ownerUserId !== userId) {
          throw new HttpError(
            403,
            'Only the board creator or a project owner can delete the board',
          );
        }
      }
      await deleteNoteBoard(params.boardId);
      return noContent();
    },
    {
      permission: ['note_boards', 'delete'],
      feature: 'notes',
      params: noteBoardParams,
      response: { 204: t.Void(), ...accessErrors },
      detail: {
        summary: 'Delete a note board',
        description:
          'Permanently delete a note board and every note on it. A public board is open to every member the role matrix allows; a private or restricted one only to the member who made it. A project owner deletes any board, including one they cannot see.',
        ...mcpTool('delete_note_board'),
      },
    },
  );
