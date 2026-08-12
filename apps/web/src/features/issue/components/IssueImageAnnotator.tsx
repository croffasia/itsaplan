'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ANNOTATION_COLORS, type Annotation, type AnnotationTool } from '../utils/annotations';
import IssueImageAnnotatorCanvas from './IssueImageAnnotatorCanvas';
import IssueImageAnnotatorToolbar from './IssueImageAnnotatorToolbar';
import Modal from '@/components/common/overlay/Modal';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// Marks an image up in a fullscreen dialog and hands the result back as a PNG;
// what happens to that file is the caller's call.
//
// The image is loaded through a blob: URL. The marks are saved by exporting the
// canvas they are drawn on, and a canvas that has drawn a cross-origin image
// cannot be exported — the api serves attachments from its own origin.
export default function IssueImageAnnotator({
  src,
  savedName,
  onSave,
  onClose,
}: {
  src: string;
  // File name without an extension, for the saved copy.
  savedName: string;
  onSave: (file: File) => void;
  onClose: () => void;
}) {
  const t = useTranslations('issue.annotator');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [tool, setTool] = useState<AnnotationTool>('rect');
  const [color, setColor] = useState(ANNOTATION_COLORS[0]);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Request failed with ${res.status}`);
        objectUrl = URL.createObjectURL(await res.blob());
        const loaded = new Image();
        loaded.src = objectUrl;
        await loaded.decode();
        if (!cancelled) setImage(loaded);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  const undo = useCallback(() => setAnnotations((prev) => prev.slice(0, -1)), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Shift is the redo half of the combination, which there is nothing to do.
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      undo();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [undo]);

  function save() {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onSave(new File([blob], `${savedName}.png`, { type: 'image/png' }));
    }, 'image/png');
  }

  return (
    <Modal
      title={t('title')}
      onClose={onClose}
      wide="xl"
      fullscreen={fullscreen}
      onToggleFullscreen={() => setFullscreen((v) => !v)}
      className="pb-3"
    >
      <div className={cn('flex min-h-0 flex-col', fullscreen && 'flex-1 overflow-hidden')}>
        <div
          className={cn(
            'flex min-h-0 items-center justify-center overflow-auto',
            fullscreen && 'flex-1',
          )}
        >
          {failed && <p className="text-sm text-destructive">{t('loadFailed')}</p>}
          {!failed && !image && <p className="text-sm text-muted-foreground">{t('loading')}</p>}
          {image && (
            <IssueImageAnnotatorCanvas
              canvasRef={canvasRef}
              // Outside fullscreen the dialog grows with the image, up to a cap;
              // in fullscreen the image is scaled down to the room it has.
              className={fullscreen ? 'max-h-full' : 'max-h-[60vh]'}
              image={image}
              tool={tool}
              color={color}
              annotations={annotations}
              onDraw={(annotation) => setAnnotations((prev) => [...prev, annotation])}
            />
          )}
        </div>

        <IssueImageAnnotatorToolbar
          tool={tool}
          onToolChange={setTool}
          color={color}
          onColorChange={setColor}
          canUndo={annotations.length > 0}
          onUndo={undo}
          onSave={save}
        />
      </div>
    </Modal>
  );
}
