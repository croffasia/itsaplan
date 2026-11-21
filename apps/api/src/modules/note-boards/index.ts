import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { getProjectAccess, requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { mcpTool } from '#mcp/generate';
import { accessErrors, commonErrors } from '#shared/responses';
import { listAccessCandidates } from '#modules/members/service';
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
  const candidates = await listAccessCandidates(projectId, 'note_boards');
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
          'List the note boards you can see, most recently updated first: public boards, your ' +
          'private boards and boards shared with you. Cards are not included: use get_note_board.',
        ...mcpTool('list_note_boards'),
      },
    },
  )

  .get(
    '/projects/:projectKey/note-boards/access-candidates',
    async ({ project }) => listAccessCandidates(project.id, 'note_boards'),
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
          'Get a board with its `canvas`, a React Flow graph `{ nodes, edges }`. A card ' +
          '(sticker, note) is a node: `{ id, type: "sticker", position: { x, y }, width, height, ' +
          'data: { title, body, color } }`. `body` is markdown and `color` is a hex string. A ' +
          'connection between two cards is an edge: `{ id, source, ' +
          'target }` of node ids. Cards exist only in the canvas.',
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
          "Create a note board. `visibility` 'private' shows it only to you. 'public' (default) " +
          'shows it to all project members. Put cards in `canvas` as nodes (see get_note_board).',
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
          'Rename a board, change its visibility, or replace its `canvas`. `visibility` is ' +
          "'public' (all project members), 'private' (only the creator), or 'restricted' (the " +
          'creator and the members in `memberIds`, which replaces the whole list). Only the ' +
          'board creator can change `visibility` and `memberIds`. To add, edit, connect or ' +
          'delete a card, change `canvas` (see get_note_board). `canvas` is replaced as a whole: ' +
          'read the board first, then send every node ' +
          'and edge to keep. Anything left out is deleted.',
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
      if ((await getProjectAccess(project.id, userId))?.role !== 'owner') {
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
          'Permanently delete a note board and all its cards. A public board: any member the ' +
          'role matrix allows. A private or restricted board: only its creator. A project owner ' +
          'can delete any board, even one they cannot see.',
        ...mcpTool('delete_note_board'),
      },
    },
  );
