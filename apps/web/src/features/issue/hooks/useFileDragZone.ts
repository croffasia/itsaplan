import { useRef, useState, type DragEvent } from 'react';

// Drag-and-drop of external files onto an element. `draggedFiles` is the number
// of files currently dragged over it, or null when nothing is; spread
// `dragHandlers` onto the element. dragenter/dragleave fire for every child, so
// they are counted and the state only clears when the pointer leaves the zone.
export function useFileDragZone(onFiles: (files: FileList) => void) {
  const [draggedFiles, setDraggedFiles] = useState<number | null>(null);
  const depth = useRef(0);

  // Only external files count; dragging a card inside the zone (which carries
  // text/html, not Files) must not open the drop zone.
  const isFileDrag = (e: DragEvent) => e.dataTransfer.types.includes('Files');

  const dragHandlers = {
    onDragEnter(e: DragEvent) {
      if (!isFileDrag(e)) return;
      depth.current += 1;
      setDraggedFiles(Array.from(e.dataTransfer.items).filter((i) => i.kind === 'file').length);
    },
    onDragOver(e: DragEvent) {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave(e: DragEvent) {
      if (!isFileDrag(e)) return;
      depth.current -= 1;
      if (depth.current <= 0) {
        depth.current = 0;
        setDraggedFiles(null);
      }
    },
    onDrop(e: DragEvent) {
      depth.current = 0;
      setDraggedFiles(null);
      // A drop onto a markdown editor inside the zone is already handled by
      // tiptap, which calls preventDefault.
      if (e.defaultPrevented || !isFileDrag(e)) return;
      const files = e.dataTransfer.files;
      if (files.length === 0) return;
      e.preventDefault();
      onFiles(files);
    },
  };

  return { draggedFiles, dragHandlers };
}
