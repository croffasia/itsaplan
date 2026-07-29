import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTheme } from 'next-themes';
import type { NoteBoard } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSetNoteBoardVisibility } from '../services/noteBoards.service';
import StickerNode, { type StickerNodeType } from './StickerNode';
import NoteCanvasTitle from './NoteCanvasTitle';
import NoteCanvasControls from './NoteCanvasControls';
import { toFlowNodes, toFlowEdges, newSticker } from '../utils/noteCanvas';
import { useCanvasAutosave, type SaveStatus } from '../hooks/useCanvasAutosave';
import { useNoteBoardAccess } from '../hooks/useNoteBoardAccess';

// The board canvas: a React Flow surface of sticky-note nodes. Changes autosave
// (see useCanvasAutosave). Keyed by board id by the host, so the state resets when
// the board changes.
export default function NoteCanvas({
  projectKey,
  board,
}: {
  projectKey: string;
  board: NoteBoard;
}) {
  const nodeTypes = useMemo(() => ({ sticker: StickerNode }), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<StickerNodeType>(
    toFlowNodes(board.canvas),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toFlowEdges(board.canvas));
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const { screenToFlowPosition } = useReactFlow();
  const { resolvedTheme } = useTheme();

  const setVisibility = useSetNoteBoardVisibility(projectKey);
  const { canEdit, canChangeVisibility } = useNoteBoardAccess(board);

  // The canvas autosave and the access changes report through one status line
  // after the board name, so changing who sees the board shows Saving…/Saved too.
  const canvasStatus = useCanvasAutosave(projectKey, board.id, nodes, edges, canEdit);
  let saveStatus: SaveStatus = 'saved';
  if (canvasStatus === 'saving' || setVisibility.isPending) saveStatus = 'saving';
  else if (canvasStatus === 'error' || setVisibility.isError) saveStatus = 'error';
  else if (canvasStatus === 'unsaved') saveStatus = 'unsaved';

  const onConnect = useCallback(
    (conn: Connection) => setEdges((eds) => addEdge(conn, eds)),
    [setEdges],
  );

  const addAt = useCallback(
    (x: number, y: number) => {
      setNodes((nds) => [...nds, newSticker(screenToFlowPosition({ x, y }))]);
    },
    [screenToFlowPosition, setNodes],
  );

  const addAtCenter = () => {
    const r = document.querySelector('.react-flow')?.getBoundingClientRect();
    addAt((r?.left ?? 0) + (r?.width ?? 0) / 2, (r?.top ?? 0) + (r?.height ?? 0) / 2);
  };

  // Only a double-click on empty canvas adds a note; double-clicking a node must not.
  const onDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    if ((e.target as HTMLElement).classList.contains('react-flow__pane')) {
      addAt(e.clientX, e.clientY);
    }
  };

  return (
    <div
      className={cn('relative flex-1', fullscreen && 'fixed inset-0 z-50 bg-background')}
      onDoubleClick={onDoubleClick}
    >
      <NoteCanvasTitle board={board} saveStatus={saveStatus} />

      <NoteCanvasControls
        projectKey={projectKey}
        canEdit={canEdit}
        visibility={board.visibility}
        ownerUserId={board.ownerUserId}
        memberIds={board.memberIds}
        canChangeVisibility={canChangeVisibility}
        fullscreen={fullscreen}
        onAddNote={addAtCenter}
        onChangeVisibility={(visibility, memberIds) =>
          setVisibility.mutate({ boardId: board.id, visibility, memberIds })
        }
        onToggleFullscreen={() => setFullscreen((v) => !v)}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodesDraggable={canEdit}
        nodesConnectable={canEdit}
        // 'Backspace' is React Flow's default; null disables deleting by key.
        deleteKeyCode={canEdit ? 'Backspace' : null}
        fitView
        // Cap the fit zoom at 1:1 so a board with a single small note is not
        // blown up to fill the viewport.
        fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
        colorMode={resolvedTheme === 'light' ? 'light' : 'dark'}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
