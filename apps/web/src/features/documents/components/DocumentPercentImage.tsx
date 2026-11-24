import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { imageStyleObject } from '@/components/common/editor/imageStyle';

const MIN_PERCENT = 25;

const HANDLE_CLASS =
  'pointer-events-auto touch-none bg-background opacity-0 shadow-[var(--overlay-shadow)] transition-opacity group-hover:opacity-100';
// The image keeps to the line-start edge, so only the line-end corners resize it.
const CORNER_CLASSES = [
  'top-1.5 cursor-nesw-resize rtl:cursor-nwse-resize',
  'bottom-1.5 cursor-nwse-resize rtl:cursor-nesw-resize',
];

// An image sized as a share of the text width, 25–100%, stored as `style="width: N%"`,
// so it keeps its proportion to the text on every screen.
export default function DocumentPercentImage({
  node,
  updateAttributes,
  editor,
  selected,
}: NodeViewProps) {
  const frameRef = useRef<HTMLSpanElement>(null);
  // Set while dragging: no transaction (and no undo step) per pointermove.
  const [dragPercent, setDragPercent] = useState<number | null>(null);

  // The handle sits on the line-end edge, so in a right-to-left page it grows leftwards.
  function startResize(event: PointerEvent) {
    const frame = frameRef.current;
    const text = frame?.parentElement;
    if (!frame || !text || !editor.isEditable) return;
    // Otherwise the pointerdown selects the node and starts a native drag.
    event.preventDefault();
    const rtl = getComputedStyle(frame).direction === 'rtl';
    const percentAt = (clientX: number) => {
      const rect = frame.getBoundingClientRect();
      const span = rtl ? rect.right - clientX : clientX - rect.left;
      return Math.round(Math.min(100, Math.max(MIN_PERCENT, (span / text.clientWidth) * 100)));
    };
    const onMove = (move: globalThis.PointerEvent) => setDragPercent(percentAt(move.clientX));
    const onUp = (up: globalThis.PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      setDragPercent(null);
      updateAttributes({ width: null, style: `width: ${percentAt(up.clientX)}%` });
      // The width saves on blur, and a drag alone leaves the editor unfocused.
      editor.commands.focus();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  // A pixel width from before percentages, or an embed's own sizing, until it is resized.
  const sizing: CSSProperties =
    dragPercent !== null
      ? { width: `${dragPercent}%` }
      : {
          ...imageStyleObject(node.attrs.style as string | null),
          ...(node.attrs.width ? { width: node.attrs.width as number } : {}),
        };
  const sized = Object.keys(sizing).length > 0;
  // Touch has no hover: tapping selects the node, the only way in there.
  const handlesShown = selected || dragPercent !== null;

  return (
    <NodeViewWrapper className="relative block max-w-full leading-none">
      <span ref={frameRef} className="group relative inline-block max-w-full" style={sizing}>
        {/* next/image needs intrinsic dimensions, which markdown does not carry. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={node.attrs.src as string}
          alt={(node.attrs.alt as string | null) ?? ''}
          title={(node.attrs.title as string | null) ?? undefined}
          className={cn('block', sized ? 'w-full' : 'max-w-full')}
          // A node view has no drag handle of its own; without one the image is stuck.
          data-drag-handle
        />
        {/* Sticky to the middle of the screen, so on a tall image the handle stays in view.
            It moves between the corner handles and never covers them. */}
        <span className="pointer-events-none absolute end-2 top-6 bottom-6 flex items-center">
          <span
            role="presentation"
            data-image-resize
            onPointerDown={startResize}
            className={cn(
              HANDLE_CLASS,
              'sticky top-[calc(50%-1.5rem)] bottom-[calc(50%-1.5rem)] h-12 max-h-full w-1.5 cursor-ew-resize rounded-full',
              handlesShown && 'opacity-100',
            )}
          />
        </span>
        {CORNER_CLASSES.map((corner) => (
          <span
            key={corner}
            role="presentation"
            data-image-resize
            onPointerDown={startResize}
            className={cn(
              HANDLE_CLASS,
              'absolute end-1.5 size-3 rounded-sm',
              corner,
              handlesShown && 'opacity-100',
            )}
          />
        ))}
      </span>
    </NodeViewWrapper>
  );
}
