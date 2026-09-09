import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type NewNoteBoardInput,
  type NoteBoard,
  type NoteBoardVisibility,
  type NoteCanvas,
  listNoteBoards,
  getNoteBoard,
  listNoteBoardAccessCandidates,
  createNoteBoard,
  updateNoteBoard,
  deleteNoteBoard,
} from '@/lib/api/endpoints/noteBoards';
import { qk } from '@/services/queryKeys';

// Invalidate every switcher/search list (but not open boards' canvases): renaming,
// creating, deleting, or changing a board's visibility all reorder or refilter the
// list. Scoped to the 'search' subtree so it never re-fetches (and clobbers) the
// canvas of a board being edited.
function invalidateSearch(qc: ReturnType<typeof useQueryClient>, projectKey: string) {
  void qc.invalidateQueries({ queryKey: [...qk.noteBoardsForProject(projectKey), 'search'] });
}

// The board switcher list: every board the caller can see, most recently updated
// first, narrowed by name on the server. The switcher is a select, so it holds them
// all rather than a window.
export function useNoteBoardSearch(projectKey: string | null, q: string) {
  return useQuery({
    queryKey: qk.noteBoardsSearch(projectKey ?? '', q),
    queryFn: () => listNoteBoards(projectKey!, { q: q || undefined }),
    enabled: projectKey != null,
  });
}

// One board with its canvas. Always refetched when opened so the canvas reflects
// the latest server state, even after edits on another device.
export function useNoteBoardQuery(projectKey: string | null, boardId: number | null) {
  return useQuery({
    queryKey: qk.noteBoard(projectKey ?? '', boardId ?? 0),
    queryFn: () => getNoteBoard(projectKey!, boardId!),
    enabled: projectKey != null && boardId != null,
    refetchOnMount: 'always',
  });
}

// Who a restricted board can be shared with: the project's members and agents,
// each with whether their role can read notes at all. Only the access picker needs
// it, so it is a query of its own rather than part of the board payload.
export function useNoteBoardAccessCandidates(projectKey: string | null) {
  return useQuery({
    queryKey: qk.noteBoardAccessCandidates(projectKey ?? ''),
    queryFn: () => listNoteBoardAccessCandidates(projectKey!),
    enabled: projectKey != null,
  });
}

export function useCreateNoteBoard(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewNoteBoardInput) => createNoteBoard(projectKey!, input),
    onSuccess: () => {
      if (projectKey) invalidateSearch(qc, projectKey);
    },
  });
}

// Renaming changes the tab/switcher list, so invalidate the search lists and write
// the new name into the open board's cache. Canvas autosave uses useSaveNoteCanvas
// instead, which must not refetch mid-edit.
export function useRenameNoteBoard(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ boardId, name }: { boardId: number; name: string }) =>
      updateNoteBoard(projectKey!, boardId, { name }),
    onSuccess: (updated) => {
      if (!projectKey) return;
      qc.setQueryData<NoteBoard>(qk.noteBoard(projectKey, updated.id), updated);
      invalidateSearch(qc, projectKey);
    },
  });
}

// Change who sees a board: public, private, or restricted to the members in
// memberIds. Changes both the board's icon and which list section it falls under,
// so refresh the lists.
export function useSetNoteBoardVisibility(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      boardId,
      visibility,
      memberIds,
    }: {
      boardId: number;
      visibility: NoteBoardVisibility;
      memberIds?: string[];
    }) => updateNoteBoard(projectKey!, boardId, { visibility, memberIds }),
    onSuccess: (updated) => {
      if (!projectKey) return;
      qc.setQueryData<NoteBoard>(qk.noteBoard(projectKey, updated.id), updated);
      invalidateSearch(qc, projectKey);
    },
  });
}

export function useDeleteNoteBoard(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (boardId: number) => deleteNoteBoard(projectKey!, boardId),
    onSuccess: (_res, boardId) => {
      if (!projectKey) return;
      qc.removeQueries({ queryKey: qk.noteBoard(projectKey, boardId) });
      invalidateSearch(qc, projectKey);
    },
  });
}

// Persist the canvas without invalidating: the editor holds the live canvas, so a
// refetch would clobber unsaved edits. The saved canvas is written back into the
// board's cache so a later remount reads the current state.
export function useSaveNoteCanvas(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ boardId, canvas }: { boardId: number; canvas: NoteCanvas }) =>
      updateNoteBoard(projectKey!, boardId, { canvas }),
    onSuccess: (updated) => {
      if (!projectKey) return;
      qc.setQueryData<NoteBoard>(qk.noteBoard(projectKey, updated.id), updated);
    },
  });
}
