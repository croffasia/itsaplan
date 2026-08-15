'use client';

import { useTranslations } from 'next-intl';
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
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { stickerColorValue } from '../utils/stickerColors';
import { stickerToIssue } from '../utils/stickerToIssue';
import StickerEditor from './StickerEditor';
import StickerToolbar from './StickerToolbar';

export type StickerNodeType = Node<NoteSticker, 'sticker'>;

// One sticky note on the canvas. Edits are written straight back into the React
// Flow node; the canvas persists the whole board. Without note_boards edit the
// card is read-only.
export default function StickerNode({ id, data, selected }: NodeProps<StickerNodeType>) {
  const { setNodes, setEdges } = useReactFlow();
  const { onAddIssue } = useShell();
  const { can } = usePermissions();
  const canCreateIssue = can('work_items', 'create');
  const canEdit = can('note_boards', 'edit');
  const [editor, setEditor] = useState<Editor | null>(null);
  const t = useTranslations('notes');

  const update = (patch: Partial<NoteSticker>) => {
    setNodes((nodes) =>
      nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  };

  // The note itself stays on the board after the issue is created.
  const convert = () => onAddIssue(stickerToIssue(data));

  const remove = () => {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
    setEdges((edges) => edges.filter((e) => e.source !== id && e.target !== id));
  };

  return (
    <div
      className="sticker-note flex h-full w-full cursor-default flex-col rounded-xl border border-black/10 p-3 text-neutral-900 shadow-lg"
      style={{ backgroundColor: stickerColorValue(data.color) }}
    >
      <NodeResizer isVisible={selected && canEdit} minWidth={200} minHeight={160} />
      <Handle type="target" position={Position.Left} className="!size-2 !bg-black/40" />
      <Handle type="source" position={Position.Right} className="!size-2 !bg-black/40" />

      <div className="mb-1 flex items-center gap-2">
        <input
          // `auto` once there is something to read, so a title keeps the script it
          // was typed in. An empty one has nothing to read from and would fall back
          // to left-to-right, taking the placeholder with it.
          dir={data.title ? 'auto' : undefined}
          value={data.title}
          onChange={(e) => update({ title: e.target.value })}
          readOnly={!canEdit}
          placeholder={t('noteTitlePlaceholder')}
          className="nodrag min-w-0 flex-1 cursor-text bg-transparent text-base font-semibold outline-none placeholder:text-black/40"
        />
        {canEdit && (
          <span
            className="sticker-drag cursor-grab text-black/30 hover:text-black/60 active:cursor-grabbing"
            title={t('dragNote')}
          >
            <GripHorizontal className="size-4" />
          </span>
        )}
      </div>

      <div className="nodrag nowheel flex-1 cursor-text overflow-y-auto text-sm">
        <StickerEditor
          value={data.body}
          onChange={(md) => update({ body: md })}
          onReady={setEditor}
          editable={canEdit}
        />
      </div>

      <div className="sticker-drag mt-2 cursor-grab border-t border-black/10 pt-2 active:cursor-grabbing">
        <StickerToolbar
          editor={editor}
          color={data.color}
          onColorChange={(key) => update({ color: key })}
          onConvert={canCreateIssue ? convert : undefined}
          onDelete={remove}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
