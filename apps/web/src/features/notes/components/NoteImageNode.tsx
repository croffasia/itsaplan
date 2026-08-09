import { GripHorizontal, ImageOff, LoaderCircle, Trash2 } from 'lucide-react';
import Image from 'next/image';
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import type { NoteImage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useNoteCanvasImageContext } from '../context/NoteCanvasImageContext';
import { useNoteBoardImageUrl } from '../hooks/useNoteBoardImageUrl';

export type NoteImageNodeType = Node<NoteImage, 'image'>;

export default function NoteImageNode({ id, data, selected }: NodeProps<NoteImageNodeType>) {
  const { setNodes, setEdges } = useReactFlow();
  const { projectKey, boardId, canEdit } = useNoteCanvasImageContext();
  const { url, error } = useNoteBoardImageUrl(projectKey, boardId, data.imageId);

  const remove = () => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
    setEdges((edges) => edges.filter((edge) => edge.source !== id && edge.target !== id));
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card shadow-lg">
      <NodeResizer isVisible={selected && canEdit} minWidth={160} minHeight={120} keepAspectRatio />
      <Handle type="target" position={Position.Left} className="!size-2" />
      <Handle type="source" position={Position.Right} className="!size-2" />

      <div className="note-image-drag flex h-9 shrink-0 cursor-grab items-center gap-2 border-b px-2 active:cursor-grabbing">
        <GripHorizontal className="size-4 shrink-0 text-muted-foreground" />
        <span
          className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
          title={data.filename}
        >
          {data.filename}
        </span>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="nodrag size-7"
            aria-label="Delete photo"
            onClick={remove}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="nodrag relative flex min-h-0 flex-1 items-center justify-center bg-muted/30">
        {url ? (
          <Image
            src={url}
            alt={data.filename}
            draggable={false}
            fill
            unoptimized
            className="object-contain"
          />
        ) : error ? (
          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <ImageOff className="size-5" />
            Photo unavailable
          </div>
        ) : (
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
