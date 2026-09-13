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
import { Button } from '@/components/ui/button';
import type { LinkPreviewItem } from './LinkPreviewDialog';
import { useLinkPreviewQuery } from './useLinkPreviewQuery';
import { linkPreviewDestination } from './linkPreviewDestination';
import { isRetryableLinkPreviewError } from './isRetryableLinkPreviewError';
import EditorLinkPreviewImage from './EditorLinkPreviewImage';
import EditorLinkPreviewDetails from './EditorLinkPreviewDetails';
import styles from './LinkPreviewDialog.module.css';

const previewIcons = {
  project: FolderKanban,
  issue: CircleDot,
  document: FileText,
  notes: StickyNote,
  view: LayoutList,
};

export default function LinkPreviewContent({ link }: { link: LinkPreviewItem }) {
  const t = useTranslations('common.editor');
  const origin = typeof window === 'undefined' ? undefined : window.location.origin;
  const destination = linkPreviewDestination(link.url, origin);
  const query = useLinkPreviewQuery(destination?.href);
  const preview = query.data;
  const internal = !!destination && destination.origin === origin;
  const loading = query.isPending || query.isFetching;
  const Icon = preview?.kind ? previewIcons[preview.kind] : Globe;
  let fallbackTitle = internal ? t('internalPage') : destination?.hostname;
  if (link.label && link.label !== link.url && link.label !== destination?.href)
    fallbackTitle = link.label;
  const title = preview?.title || fallbackTitle;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 wrap-anywhere" dir="ltr">
            {destination?.hostname}
          </span>
        </p>
        <h3 className="text-base font-medium text-pretty wrap-anywhere" dir="auto">
          {title}
        </h3>
      </div>
      {loading ? (
        <div className="space-y-3" role="status">
          <div className="h-3 w-4/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            {t('loadingPreview')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {preview?.image && <EditorLinkPreviewImage key={preview.image} src={preview.image} />}
          {preview?.description && (
            <p className="line-clamp-3 text-base text-pretty wrap-anywhere" dir="auto">
              {preview.description}
            </p>
          )}
          {preview?.kind && <EditorLinkPreviewDetails preview={preview} />}
          {!preview?.title && !preview?.description && (
            <p className="text-sm text-muted-foreground">
              {internal ? t('internalPreviewUnavailable') : t('previewUnavailable')}
            </p>
          )}
          {isRetryableLinkPreviewError(query.error) && (
            <Button
              type="button"
              variant="ghost"
              className={styles.control}
              onClick={() => void query.refetch()}
            >
              {t('retryPreview')}
            </Button>
          )}
        </div>
      )}
      <p className="rounded-md bg-muted/50 p-3 text-sm wrap-anywhere select-text" dir="ltr">
        {link.url}
      </p>
    </div>
  );
}
