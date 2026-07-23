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
import { Globe, Lock, Maximize2, Minimize2, Plus } from 'lucide-react';
import type { NoteBoard } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSetNoteBoardVisibility } from '../services/noteBoards.service';
import StickerNode, { type StickerNodeType } from './StickerNode';
import { toFlowNodes, toFlowEdges, newSticker } from '../utils/noteCanvas';
import { useCanvasAutosave, type SaveStatus } from '../hooks/useCanvasAutosave';

const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

// The board canvas: a React Flow surface of sticky-note nodes. Double-click empty
// space (or the Add note button) drops a sticker; dragging between node handles
// connects them. Changes autosave (see useCanvasAutosave). Keyed by board id by
// the host, so the state resets when the board changes.
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

  // Leave fullscreen on Escape.
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
  const personal = board.ownerUserId != null;

  // The canvas autosave and the visibility toggle report through one status line
  // after the board name, so toggling public/personal shows Saving…/Saved too.
  const canvasStatus = useCanvasAutosave(projectKey, board.id, nodes, edges);
  let saveStatus: SaveStatus = 'saved';
  if (canvasStatus === 'saving' || setVisibility.isPending) saveStatus = 'saving';
  else if (canvasStatus === 'error' || setVisibility.isError) saveStatus = 'error';
  else if (canvasStatus === 'unsaved') saveStatus = 'unsaved';

  // The status stays visible while there are unsaved edits, a save is in flight, or
  // a save failed; a successful "Saved" hides a few seconds later. An open board
  // that has not been edited shows nothing (its initial state is already "saved").
  const [showStatus, setShowStatus] = useState(false);
  useEffect(() => {
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => setShowStatus(false), 3000);
      return () => clearTimeout(timer);
    }
    setShowStatus(true);
  }, [saveStatus]);

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

  // Only a double-click on empty canvas adds a note; double-clicking a node must not.
  const onDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).classList.contains('react-flow__pane')) {
      addAt(e.clientX, e.clientY);
    }
  };

  return (
    <div
      className={cn('relative flex-1', fullscreen && 'fixed inset-0 z-50 bg-background')}
      onDoubleClick={onDoubleClick}
    >
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            aria-label={personal ? 'Make public' : 'Make private'}
            onClick={() => setVisibility.mutate({ boardId: board.id, personal: !personal })}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {personal ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
          </TooltipTrigger>
          <TooltipContent>
            {personal
              ? 'Make public — visible to every project member'
              : 'Make private — visible only to you'}
          </TooltipContent>
        </Tooltip>
        <span className="text-sm leading-none font-medium text-foreground">{board.name}</span>
        {showStatus && (
          <span
            className={cn(
              'text-xs leading-none',
              saveStatus === 'error' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {SAVE_STATUS_LABEL[saveStatus]}
          </span>
        )}
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const el = document.querySelector('.react-flow');
            const r = el?.getBoundingClientRect();
            addAt((r?.left ?? 0) + (r?.width ?? 0) / 2, (r?.top ?? 0) + (r?.height ?? 0) / 2);
          }}
        >
          <Plus className="size-4" /> Add note
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={() => setFullscreen((v) => !v)}
        >
          {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        // Cap the fit zoom at 1:1 so a board with a single small note is not
        // blown up to fill the viewport.
        fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
        // Theme the built-in controls/background to match the app theme.
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
