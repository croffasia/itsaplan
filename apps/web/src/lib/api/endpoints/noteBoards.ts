import { request } from '@/lib/api/core/client';

// One sticky note on the canvas. body is markdown (may contain task-list items).
// color keys a background swatch defined by the UI. Declared as a type alias (not
// an interface) so it carries an implicit index signature and satisfies React
// Flow's Node data constraint (Record<string, unknown>).
export type NoteSticker = {
  title: string;
  body: string;
  color: string;
};

// A React Flow node holding a sticker. Kept structurally compatible with React
// Flow's Node so the canvas can use it directly.
export interface NoteNode {
  id: string;
  type: 'sticker';
  position: { x: number; y: number };
  width?: number;
  height?: number;
  data: NoteSticker;
}

// A connection between two stickers (React Flow edge).
export interface NoteEdge {
  id: string;
  source: string;
  target: string;
}

// The board canvas, stored verbatim as jsonb on the server.
export interface NoteCanvas {
  nodes: NoteNode[];
  edges: NoteEdge[];
}

// Who sees a board: every project member, its creator alone, or its creator plus
// the members granted access.
export type NoteBoardVisibility = 'public' | 'private' | 'restricted';

export interface NoteBoard {
  id: number;
  projectId: number;
  // null for a public board; a user id for a private or restricted one.
  ownerUserId: string | null;
  // Only the creator can change who sees the board.
  createdByUserId: string | null;
  visibility: NoteBoardVisibility;
  // The members granted access besides the creator (a restricted board).
  memberIds: string[];
  name: string;
  canvas: NoteCanvas;
  createdAt: string;
  updatedAt: string;
}

// A board without its canvas or member list — what the switcher and MRU tabs list.
// The canvas is loaded one board at a time via getNoteBoard when the board is opened.
export type NoteBoardSummary = Omit<NoteBoard, 'canvas' | 'memberIds'>;

export interface NewNoteBoardInput {
  name: string;
  visibility?: Exclude<NoteBoardVisibility, 'restricted'>;
  canvas?: NoteCanvas;
}

export interface NoteBoardPatch {
  name?: string;
  canvas?: NoteCanvas;
  visibility?: NoteBoardVisibility;
  // Replaces the granted members as a whole; only on a restricted board.
  memberIds?: string[];
}

// Someone a restricted board can be shared with. `canAccess` false means their
// role cannot read notes at all, so the API rejects granting them access.
export interface NoteBoardAccessCandidate {
  userId: string;
  name: string;
  image: string | null;
  kind: 'member' | 'agent';
  canAccess: boolean;
}

export interface NoteBoardListParams {
  q?: string;
  limit?: number;
  offset?: number;
}

// Note boards — all ops are project-scoped (a board that is not public is
// filtered to who may see it server-side), so board ops take projectKey plus the
// board id. The list feeds the switcher, which shows every board, so it comes whole
// with `q` narrowing it; a single board carries its canvas.
export const listNoteBoards = (projectKey: string, params: { q?: string } = {}) =>
  request<NoteBoardSummary[]>(
    `/projects/${projectKey}/note-boards${params.q ? `?q=${encodeURIComponent(params.q)}` : ''}`,
  );

export const getNoteBoard = (projectKey: string, boardId: number) =>
  request<NoteBoard>(`/projects/${projectKey}/note-boards/${boardId}`);

export const listNoteBoardAccessCandidates = (projectKey: string) =>
  request<NoteBoardAccessCandidate[]>(`/projects/${projectKey}/note-boards/access-candidates`);

export const createNoteBoard = (projectKey: string, input: NewNoteBoardInput) =>
  request<NoteBoard>(`/projects/${projectKey}/note-boards`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateNoteBoard = (projectKey: string, boardId: number, patch: NoteBoardPatch) =>
  request<NoteBoard>(`/projects/${projectKey}/note-boards/${boardId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteNoteBoard = (projectKey: string, boardId: number) =>
  request<void>(`/projects/${projectKey}/note-boards/${boardId}`, { method: 'DELETE' });
