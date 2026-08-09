import type { Edge } from '@xyflow/react';
import type { NoteCanvas, NoteNode } from '@/lib/api';
import { stripMarkdownBreakMarkers } from '@/utils/markdown';
import type { NoteImageNodeType } from '../components/NoteImageNode';
import type { StickerNodeType } from '../components/StickerNode';
import { DEFAULT_STICKER_COLOR } from './stickerColors';

const STICKER_DRAG_HANDLE = '.sticker-drag';
const IMAGE_DRAG_HANDLE = '.note-image-drag';
const DEFAULT_STICKER_WIDTH = 260;
const DEFAULT_STICKER_HEIGHT = 220;
const DEFAULT_IMAGE_WIDTH = 320;
const DEFAULT_IMAGE_HEIGHT = 220;

export type NoteFlowNode = StickerNodeType | NoteImageNodeType;

export function toFlowNodes(canvas: NoteCanvas | undefined): NoteFlowNode[] {
  return (canvas?.nodes ?? []).map((node) => {
    if (node.type === 'image') {
      return {
        id: node.id,
        type: 'image',
        position: node.position,
        width: node.width ?? DEFAULT_IMAGE_WIDTH,
        height: node.height ?? DEFAULT_IMAGE_HEIGHT,
        dragHandle: IMAGE_DRAG_HANDLE,
        data: node.data,
      };
    }
    return {
      id: node.id,
      type: 'sticker',
      position: node.position,
      width: node.width ?? DEFAULT_STICKER_WIDTH,
      height: node.height ?? DEFAULT_STICKER_HEIGHT,
      dragHandle: STICKER_DRAG_HANDLE,
      data: { ...node.data, body: stripMarkdownBreakMarkers(node.data.body) },
    };
  });
}

export function toFlowEdges(canvas: NoteCanvas | undefined): Edge[] {
  return (canvas?.edges ?? []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));
}

export function toCanvas(nodes: NoteFlowNode[], edges: Edge[]): NoteCanvas {
  return {
    nodes: nodes.map((node): NoteNode => {
      if (node.type === 'image') {
        return {
          id: node.id,
          type: 'image',
          position: node.position,
          width: node.width ?? DEFAULT_IMAGE_WIDTH,
          height: node.height ?? DEFAULT_IMAGE_HEIGHT,
          data: node.data,
        };
      }
      return {
        id: node.id,
        type: 'sticker',
        position: node.position,
        width: node.width ?? DEFAULT_STICKER_WIDTH,
        height: node.height ?? DEFAULT_STICKER_HEIGHT,
        data: node.data,
      };
    }),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  };
}

export function newSticker(position: { x: number; y: number }): StickerNodeType {
  return {
    id: crypto.randomUUID(),
    type: 'sticker',
    position,
    width: DEFAULT_STICKER_WIDTH,
    height: DEFAULT_STICKER_HEIGHT,
    dragHandle: STICKER_DRAG_HANDLE,
    data: { title: '', body: '', color: DEFAULT_STICKER_COLOR },
  };
}

export function newImageNode(
  position: { x: number; y: number },
  image: { id: string; filename: string; contentType: string },
  aspectRatio: number,
): NoteImageNodeType {
  const width = aspectRatio < 0.8 ? 240 : DEFAULT_IMAGE_WIDTH;
  const height = Math.max(140, Math.min(360, width / aspectRatio));
  return {
    id: crypto.randomUUID(),
    type: 'image',
    position,
    width,
    height,
    dragHandle: IMAGE_DRAG_HANDLE,
    data: {
      imageId: image.id,
      filename: image.filename,
      contentType: image.contentType,
    },
  };
}
