import { useRef, useState, type DragEvent } from 'react';

export function useFileDragZone(onFiles: (files: FileList) => void) {
  const [draggedFiles, setDraggedFiles] = useState<number | null>(null);
  const depth = useRef(0);
  const isFileDrag = (event: DragEvent) => event.dataTransfer.types.includes('Files');

  const dragHandlers = {
    onDragEnter(event: DragEvent) {
      if (!isFileDrag(event)) return;
      depth.current += 1;
      setDraggedFiles(
        Array.from(event.dataTransfer.items).filter((item) => item.kind === 'file').length,
      );
    },
    onDragOver(event: DragEvent) {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave(event: DragEvent) {
      if (!isFileDrag(event)) return;
      depth.current -= 1;
      if (depth.current <= 0) {
        depth.current = 0;
        setDraggedFiles(null);
      }
    },
    onDrop(event: DragEvent) {
      depth.current = 0;
      setDraggedFiles(null);
      if (event.defaultPrevented || !isFileDrag(event)) return;
      if (event.dataTransfer.files.length === 0) return;
      event.preventDefault();
      onFiles(event.dataTransfer.files);
    },
  };

  return { draggedFiles, dragHandlers };
}
