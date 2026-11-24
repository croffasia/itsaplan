'use client';

import { useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import type { Attachment } from '@/lib/api/endpoints/attachments';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import AttachmentPreviewFallback from './AttachmentPreviewFallback';
import AttachmentTextPreview from './AttachmentTextPreview';
import { exceedsPreviewLimit, type AttachmentPreviewKind } from './attachmentPreviewKind';

// Each document engine is megabytes of WebAssembly and uses browser-only APIs, so
// it is fetched when a file of its type is opened and never rendered on the server.
const loading = () => <Skeleton className="h-[70vh] w-full" />;
const PdfViewer = dynamic(() => import('@/components/extend/pdf-viewer').then((m) => m.PDFViewer), {
  ssr: false,
  loading,
});
const DocxViewer = dynamic(
  () => import('@/components/extend/docx-viewer').then((m) => m.DocxViewerPreview),
  { ssr: false, loading },
);
const XlsxViewer = dynamic(
  () => import('@/components/extend/xlsx-viewer').then((m) => m.XlsxViewerPreview),
  { ssr: false, loading },
);
const PptxViewer = dynamic(
  () => import('@/components/extend/pptx-viewer').then((m) => m.PptxViewerPreview),
  { ssr: false, loading },
);
const AttachmentCsvPreview = dynamic(() => import('./AttachmentCsvPreview'), {
  ssr: false,
  loading,
});

export default function AttachmentPreview({
  attachment,
  kind,
  fullscreen,
}: {
  attachment: Attachment;
  kind: AttachmentPreviewKind;
  fullscreen: boolean;
}) {
  const t = useTranslations('common.attachmentPreview');
  const { resolvedTheme } = useTheme();
  // Word and Excel files can be recoloured for a dark page; the viewer's own
  // switch turns that off for a reader who wants the document as authored.
  const [dark, setDark] = useState(resolvedTheme === 'dark');

  if (exceedsPreviewLimit(kind, attachment.sizeBytes))
    return <AttachmentPreviewFallback attachment={attachment} message={t('tooLarge')} />;

  const mediaSize = fullscreen ? 'max-h-full' : 'max-h-[70vh]';
  const size = fullscreen ? 'h-full' : 'h-[70vh]';
  const viewerProps = {
    src: attachment.url,
    fileName: attachment.filename,
    showUpload: false,
    className: 'h-full w-full rounded-md border',
  };
  const frame = (viewer: ReactNode) => (
    <div dir="ltr" className={cn('w-full', size)}>
      {viewer}
    </div>
  );

  switch (kind) {
    case 'image':
      return (
        // Not next/image: the bytes behind the URL can be replaced, and the
        // optimizer would keep serving the version it cached.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.url}
          alt={attachment.filename}
          className={cn('max-w-full rounded-md', mediaSize)}
        />
      );
    case 'video':
      return (
        <video src={attachment.url} controls className={cn('max-w-full rounded-md', mediaSize)} />
      );
    case 'pdf':
      return frame(<PdfViewer {...viewerProps} />);
    case 'docx':
      return frame(<DocxViewer {...viewerProps} isDark={dark} onIsDarkChange={setDark} />);
    case 'xlsx':
      return frame(<XlsxViewer {...viewerProps} isDark={dark} onIsDarkChange={setDark} />);
    case 'pptx':
      return frame(<PptxViewer {...viewerProps} />);
    case 'csv':
      return <AttachmentCsvPreview attachment={attachment} className={size} />;
    case 'markdown':
    case 'text':
      return (
        <AttachmentTextPreview
          attachment={attachment}
          markdown={kind === 'markdown'}
          className={fullscreen ? 'h-full' : 'max-h-[70vh]'}
        />
      );
  }
}
