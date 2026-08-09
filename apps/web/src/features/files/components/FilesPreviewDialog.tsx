import { useEffect, useState } from 'react';
import type { ProjectFile } from '@/lib/api';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import Modal from '@/components/common/overlay/Modal';
import { Skeleton } from '@/components/ui/skeleton';
import { filePreviewType, hasValidPreviewSignature } from '../utils/filePreview';

export default function FilesPreviewDialog({
  file,
  onClose,
}: {
  file: ProjectFile;
  onClose: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const type = filePreviewType(file);

  useEffect(() => {
    if (!type) return;
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(null);

    void api
      .downloadProjectFile(file.id)
      .then(async (blob) => {
        if (!(await hasValidPreviewSignature(blob, type))) {
          throw new Error('The file contents do not match its preview format.');
        }
        if (!active) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type }));
        setUrl(objectUrl);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Preview failed');
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, type]);

  if (!type) return null;

  return (
    <Modal
      title={file.filename}
      description={type === 'application/pdf' ? 'PDF preview' : 'PNG preview'}
      onClose={onClose}
      wide="xl"
      fullscreen={fullscreen}
      onToggleFullscreen={() => setFullscreen((value) => !value)}
    >
      <div
        className={cn(
          'flex min-h-[60vh] min-w-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30',
          fullscreen && 'min-h-0 flex-1',
        )}
      >
        {error ? (
          <p className="max-w-sm px-6 text-center text-sm text-muted-foreground">{error}</p>
        ) : !url ? (
          <Skeleton className="m-6 h-[55vh] w-full" />
        ) : type === 'image/png' ? (
          // The authenticated object URL is temporary and cannot use next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={file.filename} className="max-h-full max-w-full object-contain" />
        ) : (
          <iframe
            src={url}
            title={`Preview of ${file.filename}`}
            sandbox="allow-same-origin"
            className="h-[70vh] w-full bg-white"
          />
        )}
      </div>
    </Modal>
  );
}
