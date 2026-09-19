import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { loadImageFromBlob } from '../utils/renderPost';

// The generated photo of a post, ready to draw. It is fetched as a blob rather
// than pointed at with a src, because the raw file route needs the session cookie
// and a blob URL keeps the canvas exportable.
export function useStudioPhoto(fileId: string | null): HTMLImageElement | null {
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!fileId) {
      setPhoto(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const image = await loadImageFromBlob(await api.downloadProjectFile(fileId));
        if (!cancelled) setPhoto(image);
      } catch {
        if (!cancelled) setPhoto(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  return photo;
}
