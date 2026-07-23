import { useState } from 'react';
import { type Editor } from '@tiptap/react';
import { GripHorizontal } from 'lucide-react';
import {
  Handle,
  Position,
  NodeResizer,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import type { NoteSticker } from '@/lib/api';
import { stickerColorValue } from '../utils/stickerColors';
import StickerEditor from './StickerEditor';
import StickerToolbar from './StickerToolbar';

export type StickerNodeType = Node<NoteSticker, 'sticker'>;

// One sticky note on the canvas: a draggable, resizable card with a title, a
// markdown body (text and checklists), and a bottom toolbar (color, bold, italic,
// checklist, delete). Edits are written straight back into the React Flow node;
// the canvas persists the whole board.
export default function StickerNode({ id, data, selected }: NodeProps<StickerNodeType>) {
  const { setNodes, setEdges } = useReactFlow();
  const [editor, setEditor] = useState<Editor | null>(null);

  const update = (patch: Partial<NoteSticker>) => {
    setNodes((nodes) =>
      nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  };

  const remove = () => {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
    setEdges((edges) => edges.filter((e) => e.source !== id && e.target !== id));
  };

  return (
    <div
      className="sticker-note flex h-full w-full cursor-default flex-col rounded-xl border border-black/10 p-3 text-neutral-900 shadow-lg"
      style={{ backgroundColor: stickerColorValue(data.color) }}
    >
      <NodeResizer isVisible={selected} minWidth={200} minHeight={160} />
      <Handle type="target" position={Position.Left} className="!size-2 !bg-black/40" />
      <Handle type="source" position={Position.Right} className="!size-2 !bg-black/40" />

      <div className="mb-1 flex items-center gap-2">
        <input
          value={data.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Title"
          className="nodrag min-w-0 flex-1 cursor-text bg-transparent text-base font-semibold outline-none placeholder:text-black/40"
        />
        <span
          className="sticker-drag cursor-grab text-black/30 hover:text-black/60 active:cursor-grabbing"
          title="Drag note"
        >
          <GripHorizontal className="size-4" />
        </span>
      </div>

      <div className="nodrag nowheel flex-1 cursor-text overflow-y-auto text-sm">
        <StickerEditor
          value={data.body}
          onChange={(md) => update({ body: md })}
          onReady={setEditor}
        />
      </div>

      <div className="sticker-drag mt-2 cursor-grab border-t border-black/10 pt-2 active:cursor-grabbing">
        <StickerToolbar
          editor={editor}
          color={data.color}
          onColorChange={(key) => update({ color: key })}
          onDelete={remove}
        />
      </div>
    </div>
  );
}
