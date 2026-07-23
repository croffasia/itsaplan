import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type NewNoteBoardInput,
  type NoteBoard,
  type NoteBoardSummary,
  type NoteCanvas,
} from '@/lib/api';
import { qk } from '@/services/queryKeys';

// How many boards the switcher loads per page.
export const NOTE_BOARDS_PAGE = 10;

// Invalidate every switcher/search list (but not open boards' canvases): renaming,
// creating, deleting, or changing a board's visibility all reorder or refilter the
// list. Scoped to the 'search' subtree so it never re-fetches (and clobbers) the
// canvas of a board being edited.
function invalidateSearch(qc: ReturnType<typeof useQueryClient>, projectKey: string) {
  void qc.invalidateQueries({ queryKey: [...qk.noteBoardsForProject(projectKey), 'search'] });
}

// The board switcher list: name-filtered, paged, most-recently-updated first.
export function useNoteBoardSearch(projectKey: string | null, q: string) {
  return useInfiniteQuery({
    queryKey: qk.noteBoardsSearch(projectKey ?? '', q),
    queryFn: ({ pageParam }) =>
      api.listNoteBoards(projectKey!, {
        q: q || undefined,
        limit: NOTE_BOARDS_PAGE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < NOTE_BOARDS_PAGE ? undefined : allPages.reduce((n, p) => n + p.length, 0),
    enabled: projectKey != null,
  });
}

// One board with its canvas. Always refetched when opened so the canvas reflects
// the latest server state, even after edits on another device.
export function useNoteBoardQuery(projectKey: string | null, boardId: number | null) {
  return useQuery({
    queryKey: qk.noteBoard(projectKey ?? '', boardId ?? 0),
    queryFn: () => api.getNoteBoard(projectKey!, boardId!),
    enabled: projectKey != null && boardId != null,
    refetchOnMount: 'always',
  });
}

export function useCreateNoteBoard(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewNoteBoardInput) => api.createNoteBoard(projectKey!, input),
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
      api.updateNoteBoard(projectKey!, boardId, { name }),
    onSuccess: (updated) => {
      if (!projectKey) return;
      qc.setQueryData<NoteBoard>(qk.noteBoard(projectKey, updated.id), updated);
      invalidateSearch(qc, projectKey);
    },
  });
}

// Toggle a board between public and personal (owned by the caller). Changes both
// the lock icon and which list section it falls under, so refresh the lists.
export function useSetNoteBoardVisibility(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ boardId, personal }: { boardId: number; personal: boolean }) =>
      api.updateNoteBoard(projectKey!, boardId, { personal }),
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
    mutationFn: (boardId: number) => api.deleteNoteBoard(projectKey!, boardId),
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
      api.updateNoteBoard(projectKey!, boardId, { canvas }),
    onSuccess: (updated) => {
      if (!projectKey) return;
      qc.setQueryData<NoteBoard>(qk.noteBoard(projectKey, updated.id), updated);
    },
  });
}

// Flatten the switcher's paged result into a single board list, so a consumer can
// read the boards without threading useInfiniteQuery's page shape.
export function flattenBoardPages(pages: NoteBoardSummary[][] | undefined): NoteBoardSummary[] {
  return pages?.flat() ?? [];
}
