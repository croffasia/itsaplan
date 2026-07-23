import { useEffect, useMemo, useRef, useState } from 'react';
import type { Edge } from '@xyflow/react';
import { useSaveNoteCanvas } from '../services/noteBoards.service';
import type { StickerNodeType } from '../components/StickerNode';
import { toCanvas } from '../utils/noteCanvas';

// 'unsaved' — edits made, not yet persisted (waiting out the debounce);
// 'saving' — the save request is in flight; 'saved'/'error' — its result.
export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

// The debounce between the last edit and the save request.
const AUTOSAVE_DELAY = 2000;

// Persist the board a while after the last change, reporting the save state so the
// UI can show it. A change first marks the canvas 'unsaved', then after the debounce
// the request goes out ('saving') and its result is 'saved' or 'error'. Opening a
// board does not save it (the initial canvas matches the saved snapshot). The host
// keys the canvas by board id, so one hook instance covers one board.
export function useCanvasAutosave(
  projectKey: string,
  boardId: number,
  nodes: StickerNodeType[],
  edges: Edge[],
): SaveStatus {
  const save = useSaveNoteCanvas(projectKey);
  const saveRef = useRef(save);
  saveRef.current = save;

  const serialized = useMemo(() => JSON.stringify(toCanvas(nodes, edges)), [nodes, edges]);

  // The last canvas that was loaded or saved. A save fires only when the current
  // canvas differs from it — so opening a board does not save (the effect running
  // twice under StrictMode, or React Flow's post-mount node normalization, both
  // leave the serialized canvas unchanged and are ignored).
  const savedSnapshot = useRef(serialized);
  const [status, setStatus] = useState<SaveStatus>('saved');

  // The latest canvas, read by the unmount flush below.
  const latest = useRef({ serialized, boardId });
  latest.current = { serialized, boardId };

  useEffect(() => {
    if (serialized === savedSnapshot.current) return;
    setStatus('unsaved');
    const timer = setTimeout(() => {
      setStatus('saving');
      saveRef.current.mutate(
        { boardId, canvas: JSON.parse(serialized) },
        {
          onSuccess: () => {
            savedSnapshot.current = serialized;
            setStatus('saved');
          },
          onError: () => setStatus('error'),
        },
      );
    }, AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [serialized, boardId]);

  // Flush a still-pending edit on unmount (switching board, or leaving the page)
  // so a change made inside the debounce window is not dropped. The debounce
  // effect above clears its timer on unmount, so without this the save never fires.
  useEffect(() => {
    return () => {
      const { serialized, boardId } = latest.current;
      if (serialized !== savedSnapshot.current) {
        saveRef.current.mutate({ boardId, canvas: JSON.parse(serialized) });
      }
    };
  }, []);

  return status;
}
