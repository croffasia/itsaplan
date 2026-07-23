import type { Edge } from '@xyflow/react';
import type { NoteCanvas, NoteNode } from '@/lib/api';
import type { StickerNodeType } from '../components/StickerNode';
import { DEFAULT_STICKER_COLOR } from './stickerColors';

// A dropped sticker drags only by its handle (see StickerNode), so text and the
// toolbar stay interactive.
const DRAG_HANDLE = '.sticker-drag';

const DEFAULT_WIDTH = 260;
const DEFAULT_HEIGHT = 220;

// Build the React Flow nodes for a stored board. Runtime-only fields (dragHandle)
// are re-applied here rather than persisted.
export function toFlowNodes(canvas: NoteCanvas | undefined): StickerNodeType[] {
  return (canvas?.nodes ?? []).map((n) => ({
    id: n.id,
    type: 'sticker',
    position: n.position,
    width: n.width ?? DEFAULT_WIDTH,
    height: n.height ?? DEFAULT_HEIGHT,
    dragHandle: DRAG_HANDLE,
    data: n.data,
  }));
}

export function toFlowEdges(canvas: NoteCanvas | undefined): Edge[] {
  return (canvas?.edges ?? []).map((e) => ({ id: e.id, source: e.source, target: e.target }));
}

// Reduce the live React Flow state to the persisted shape, dropping runtime fields
// (selection, drag state, measured sizes) so saves stay stable.
export function toCanvas(nodes: StickerNodeType[], edges: Edge[]): NoteCanvas {
  return {
    nodes: nodes.map((n): NoteNode => ({
      id: n.id,
      type: 'sticker',
      position: n.position,
      width: n.width ?? DEFAULT_WIDTH,
      height: n.height ?? DEFAULT_HEIGHT,
      data: n.data,
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

export function newSticker(position: { x: number; y: number }): StickerNodeType {
  return {
    id: crypto.randomUUID(),
    type: 'sticker',
    position,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    dragHandle: DRAG_HANDLE,
    data: { title: '', body: '', color: DEFAULT_STICKER_COLOR },
  };
}
