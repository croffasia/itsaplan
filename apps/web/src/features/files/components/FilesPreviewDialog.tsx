import { useEffect, useState } from 'react';
import type { ProjectFile } from '@/lib/api';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import Modal from '@/components/common/overlay/Modal';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TEXT_PREVIEW_MAX_CHARS,
  filePreviewType,
  hasValidPreviewSignature,
} from '../utils/filePreview';

export default function FilesPreviewDialog({
  file,
  onClose,
}: {
  file: ProjectFile;
  onClose: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preview = filePreviewType(file);

  useEffect(() => {
    if (!preview) return;
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setText(null);
    setError(null);

    void api
      .downloadProjectFile(file.id)
      .then(async (blob) => {
        if (!(await hasValidPreviewSignature(blob, preview))) {
          throw new Error('The file contents do not match its preview format.');
        }
        if (!active) return;
        if (preview.kind === 'text') {
          const content = await blob.text();
          if (active) setText(content.slice(0, TEXT_PREVIEW_MAX_CHARS));
          return;
        }
        // The blob is relabelled with the type the signature proved, so the
        // browser never renders it as whatever the uploader claimed.
        objectUrl = URL.createObjectURL(new Blob([blob], { type: preview.type }));
        setUrl(objectUrl);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Preview failed');
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // The preview descriptor is derived from the file, so the file identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);

  if (!preview) return null;
  const ready = preview.kind === 'text' ? text !== null : url !== null;

  return (
    <Modal
      title={file.filename}
      description={`${preview.label} preview`}
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
        ) : !ready ? (
          <Skeleton className="m-6 h-[55vh] w-full" />
        ) : preview.kind === 'image' ? (
          // The authenticated object URL is temporary and cannot use next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url!} alt={file.filename} className="max-h-full max-w-full object-contain" />
        ) : preview.kind === 'text' ? (
          <pre className="h-[70vh] w-full overflow-auto bg-card p-4 text-left font-mono text-xs whitespace-pre-wrap">
            {text}
          </pre>
        ) : (
          // The browser's own PDF viewer. It runs in its own process and cannot
          // reach this page, which an iframe holding the document itself could.
          <object
            data={url!}
            type="application/pdf"
            aria-label={`Preview of ${file.filename}`}
            className="h-[70vh] w-full bg-white"
          >
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              This browser will not display the PDF.{' '}
              <a href={url!} target="_blank" rel="noreferrer" className="underline">
                Open it in a new tab
              </a>
              .
            </p>
          </object>
        )}
      </div>
    </Modal>
  );
}
