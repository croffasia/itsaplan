import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { cn } from '@/lib/utils';

// Below this an image is too small to grab again.
const MIN_WIDTH = 60;

// The node's `style` attribute holds raw CSS text; React takes the parsed form.
function styleObject(css: string | null): CSSProperties {
  if (!css) return {};
  return Object.fromEntries(
    css.split(';').flatMap((declaration) => {
      const [property, ...rest] = declaration.split(':');
      const value = rest.join(':').trim();
      if (!property?.trim() || !value) return [];
      const camelCased = property
        .trim()
        .replaceAll(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return [[camelCased, value]];
    }),
  );
}

// Only the width is stored — .md-content img keeps height:auto.
export default function EditorResizableImage({
  node,
  updateAttributes,
  editor,
  selected,
}: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  // Set while dragging: no transaction (and no undo step) per pointermove.
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  const width = dragWidth ?? (node.attrs.width as number | null);

  function startResize(event: ReactPointerEvent) {
    const img = imgRef.current;
    if (!img) return;
    // Otherwise the pointerdown selects the node and starts a native drag.
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = img.getBoundingClientRect().width;
    // Wider than the editor is not reachable on screen, so do not store it.
    const maxWidth = editor.view.dom.clientWidth;
    const widthAt = (clientX: number) =>
      Math.round(Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + clientX - startX)));

    const onMove = (move: globalThis.PointerEvent) => setDragWidth(widthAt(move.clientX));
    const onUp = (up: globalThis.PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      setDragWidth(null);
      updateAttributes({ width: widthAt(up.clientX) });
      // The width saves on blur, and a drag alone leaves the editor unfocused.
      editor.commands.focus();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  return (
    <NodeViewWrapper className="group relative inline-block max-w-full leading-none">
      {/* next/image needs intrinsic dimensions, which markdown does not carry. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string | null) ?? ''}
        title={(node.attrs.title as string | null) ?? undefined}
        // The dragged width wins over the embed's own sizing.
        style={{ ...styleObject(node.attrs.style as string | null), ...(width ? { width } : {}) }}
        // A node view has no drag handle of its own; without one the image is stuck.
        data-drag-handle
      />
      {editor.isEditable && (
        <span
          role="presentation"
          onPointerDown={startResize}
          className={cn(
            'absolute right-1 bottom-1 size-3 cursor-nwse-resize rounded-sm border border-background bg-primary opacity-0 transition-opacity group-hover:opacity-100',
            // Touch has no hover: tapping selects the node, the only way in there.
            selected && 'opacity-100',
          )}
        />
      )}
    </NodeViewWrapper>
  );
}
