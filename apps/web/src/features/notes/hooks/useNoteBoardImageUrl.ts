import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function useNoteBoardImageUrl(projectKey: string, boardId: number, imageId: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(false);

    void api
      .downloadNoteBoardImage(projectKey, boardId, imageId)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectKey, boardId, imageId]);

  return { url, error };
}
