import { useEffect, useRef } from 'react';

type OnFiles = (files: FileList) => void;

// The handler of every mounted surface, in mount order. Several surfaces can be on
// screen at once — the issue detail panel over the issue page, the create modal
// over either — and the paste belongs to the one on top, the last one mounted.
const surfaces: { current: OnFiles | null }[] = [];

// Files pasted while the focus is on nothing that takes them itself. The listener
// is on the document because the focus may sit anywhere on the page, including on
// the body. A markdown editor takes its own pastes — tiptap inserts the files at
// the caret — so a paste inside one is left alone. Pass null for `onFiles` while
// there is nothing to paste into; the surface still keeps the paste from reaching
// the one below it.
export function useFilePaste(onFiles: OnFiles | null) {
  // Read through a ref: the listener is registered once, while the callback
  // closes over state that arrives later.
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;

  useEffect(() => {
    surfaces.push(onFilesRef);

    function onPaste(e: ClipboardEvent) {
      if (surfaces[surfaces.length - 1] !== onFilesRef) return;
      const handle = onFilesRef.current;
      if (!handle) return;
      const files = e.clipboardData?.files;
      if (!files || files.length === 0) return;
      const target = e.target;
      if (target instanceof Element && target.closest('.ProseMirror')) return;
      e.preventDefault();
      handle(files);
    }

    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('paste', onPaste);
      surfaces.splice(surfaces.indexOf(onFilesRef), 1);
    };
  }, []);
}
