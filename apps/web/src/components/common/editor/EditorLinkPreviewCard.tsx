import {
  CircleDot,
  FileText,
  FolderKanban,
  Globe,
  LayoutList,
  LoaderCircle,
  StickyNote,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ResolvedLinkPreview } from './resolveLinkPreview';
import EditorLinkPreviewImage from './EditorLinkPreviewImage';
import EditorLinkPreviewDetails from './EditorLinkPreviewDetails';
import EditorLinkPreviewActions from './EditorLinkPreviewActions';

const previewIcons = {
  project: FolderKanban,
  issue: CircleDot,
  document: FileText,
  notes: StickyNote,
  view: LayoutList,
};

export default function EditorLinkPreviewCard({
  url,
  preview,
  loading,
  onEdit,
}: {
  url: string;
  preview: ResolvedLinkPreview | undefined;
  loading: boolean;
  onEdit?: () => void;
}) {
  const t = useTranslations('common.editor');
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, '');
  const internal = typeof window !== 'undefined' && parsed.origin === window.location.origin;
  const Icon = preview?.kind ? previewIcons[preview.kind] : Globe;
  const fallbackTitle = internal ? t('internalPage') : host;
  return (
    <div className="text-start">
      {preview?.image && (
        <EditorLinkPreviewImage
          key={preview.image}
          src={preview.image}
          className="rounded-t-lg rounded-b-none"
        />
      )}
      <div className="space-y-2 p-3">
        <div className="flex items-start gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted">
            <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            {loading ? (
              <div className="space-y-2 py-1" role="status">
                <div className="h-3 w-40 max-w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LoaderCircle
                    className="size-3 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  {t('loadingPreview')}
                </span>
              </div>
            ) : (
              <p className="line-clamp-2 text-sm font-medium text-pretty" dir="auto">
                {preview?.title || preview?.siteName || fallbackTitle}
              </p>
            )}
            <p className="text-xs break-all text-muted-foreground" dir="ltr" title={url}>
              {parsed.hostname + parsed.pathname}
            </p>
          </div>
        </div>
        {!loading && (
          <>
            {preview?.description && (
              <p
                className="line-clamp-3 text-[13px] leading-snug text-pretty text-muted-foreground"
                dir="auto"
              >
                {preview.description}
              </p>
            )}
            {!preview?.title && !preview?.description && (
              <p className="text-xs text-pretty text-muted-foreground">
                {internal ? t('internalPreviewUnavailable') : t('previewUnavailable')}
              </p>
            )}
            {preview?.kind && <EditorLinkPreviewDetails preview={preview} />}
          </>
        )}
        <EditorLinkPreviewActions url={url} onEdit={onEdit} />
      </div>
    </div>
  );
}
