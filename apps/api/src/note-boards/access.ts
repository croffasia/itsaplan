import { HttpError } from '../shared/lib';
import { getNoteBoard, type NoteBoardRow } from './store';

export async function requireAccessibleNoteBoard(
  boardId: number,
  projectId: number,
  userId: string,
): Promise<NoteBoardRow> {
  const board = await getNoteBoard(boardId);
  if (!board || board.projectId !== projectId) throw new HttpError(404, 'Board not found');
  if (
    board.ownerUserId !== null &&
    board.ownerUserId !== userId &&
    !board.memberIds.includes(userId)
  ) {
    throw new HttpError(404, 'Board not found');
  }
  return board;
}
