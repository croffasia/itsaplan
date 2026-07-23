'use client';

import { useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ReactFlowProvider } from '@xyflow/react';
import { useShell } from '@/context/shellContext';
import { ApiError } from '@/lib/api';
import { notePath, notesPath } from '@/utils/paths';
import { qk } from '@/services/queryKeys';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useNoteBoardSearch,
  useNoteBoardQuery,
  useCreateNoteBoard,
  useRenameNoteBoard,
  useSetNoteBoardVisibility,
  useDeleteNoteBoard,
  flattenBoardPages,
} from './services/noteBoards.service';
import { useNoteBoardMru, type MruEntry } from './hooks/useNoteBoardMru';
import NoteBoardBar from './components/NoteBoardBar';
import NoteCanvas from './components/NoteCanvas';
import NotesEmptyState from './components/NotesEmptyState';

// The maximum number of tabs shown (matches the MRU cap).
const MAX_TABS = 5;

// The notes section: a tab strip of recently-used boards over a freeform canvas of
// sticky notes. The active board comes from the route, falling back to the first
// tab. Tabs are the recently-used boards, topped up from the first page of the
// switcher list when fewer than MAX_TABS have been opened. Opening a board loads
// it fresh (its full canvas) and moves it to the front of the tab strip.
export default function NotesPage() {
  const { project } = useShell();
  const params = useParams<{ projectKey: string; boardId?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const projectKey = params.projectKey;

  const { entries: mru, record, remove: removeMru } = useNoteBoardMru(projectKey);
  // The first page of the switcher list, reused to top up the tabs. Shares its
  // cache with the switcher's empty-query page.
  const seedQuery = useNoteBoardSearch(projectKey, '');
  const seed = flattenBoardPages(seedQuery.data?.pages);

  const createBoard = useCreateNoteBoard(projectKey);
  const renameBoard = useRenameNoteBoard(projectKey);
  const setVisibility = useSetNoteBoardVisibility(projectKey);
  const deleteBoard = useDeleteNoteBoard(projectKey);

  const tabs = useMemo<MruEntry[]>(() => {
    const result = [...mru];
    const seen = new Set(mru.map((e) => e.id));
    for (const b of seed) {
      if (result.length >= MAX_TABS) break;
      if (seen.has(b.id)) continue;
      result.push({ id: b.id, name: b.name, personal: b.ownerUserId != null });
      seen.add(b.id);
    }
    return result;
  }, [mru, seed]);

  const routeId = params.boardId ? Number(params.boardId) : null;
  const activeBoardId = routeId ?? tabs[0]?.id ?? null;

  const { data: activeBoard, isError, error } = useNoteBoardQuery(projectKey, activeBoardId);

  // Record the opened board as most-recent once it loads. Also refreshes its cached
  // tab label and visibility, healing a stale MRU entry (renamed elsewhere).
  useEffect(() => {
    if (activeBoard) {
      record({
        id: activeBoard.id,
        name: activeBoard.name,
        personal: activeBoard.ownerUserId != null,
      });
    }
  }, [activeBoard, record]);

  // A board that is gone or no longer accessible: drop it from the MRU tabs, drop
  // it from the switcher lists (it may still be in a stale seed page), and fall
  // back to the board list.
  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 404 && activeBoardId != null) {
      removeMru(activeBoardId);
      void qc.invalidateQueries({ queryKey: [...qk.noteBoardsForProject(projectKey), 'search'] });
      router.replace(notesPath(projectKey));
    }
  }, [isError, error, activeBoardId, removeMru, qc, router, projectKey]);

  if (!project || seedQuery.isLoading) {
    return (
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-8 w-full max-w-md" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  async function create(name: string, personal: boolean) {
    const board = await createBoard.mutateAsync({ name, personal });
    router.push(notePath(projectKey, board.id));
  }

  function remove(boardId: number) {
    deleteBoard.mutate(boardId, {
      onSuccess: () => {
        removeMru(boardId);
        if (boardId === activeBoardId) router.push(notesPath(projectKey));
      },
    });
  }

  function renderContent() {
    if (activeBoard) {
      return (
        <ReactFlowProvider key={activeBoard.id}>
          <NoteCanvas projectKey={projectKey} board={activeBoard} />
        </ReactFlowProvider>
      );
    }
    // A board is selected but its canvas is still loading.
    if (activeBoardId != null && !isError) {
      return <Skeleton className="m-6 flex-1" />;
    }
    return <NotesEmptyState projectKey={projectKey} onCreate={create} />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <NoteBoardBar
        projectKey={projectKey}
        tabs={tabs}
        activeBoardId={activeBoardId}
        onSelect={(id) => router.push(notePath(projectKey, id))}
        onCreate={create}
        onRename={(id, name) => renameBoard.mutate({ boardId: id, name })}
        onToggleVisibility={(id, personal) => setVisibility.mutate({ boardId: id, personal })}
        onDelete={remove}
      />

      {renderContent()}
    </div>
  );
}
