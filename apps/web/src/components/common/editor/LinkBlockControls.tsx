import { Eye } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { LinkPreviewItem } from './LinkPreviewDialog';
import LinkPreviewThumbnail from './LinkPreviewThumbnail';
import { useVisibleLinkPreview } from './useVisibleLinkPreview';
import { linkDestination } from './linkPresentation';
import { internalLinkTarget } from './internalLinkTarget';
import styles from './LinkPresentation.module.css';

function preventEditorFocus(event: MouseEvent<HTMLElement>) {
  // Safari can focus the editing host and remove this widget before its click.
  event.preventDefault();
  event.stopPropagation();
}

export default function LinkBlockControls({
  links,
  compact,
  onPreview,
  expanded = false,
}: {
  links: LinkPreviewItem[];
  compact: boolean;
  onPreview: (links: LinkPreviewItem[], trigger: HTMLButtonElement) => void;
  expanded?: boolean;
}) {
  const t = useTranslations('common.editor');
  const link = links[0];
  const { ref, preview } = useVisibleLinkPreview(compact ? link.url : undefined);
  const destination = linkDestination(link.url, window.location.origin);
  const name = preview?.title || destination.hostname;
  const url = new URL(link.url, window.location.origin);
  const internal = url.origin === window.location.origin ? internalLinkTarget(url) : null;
  const kind = internal?.kind === 'issueId' ? 'issue' : internal?.kind;
  let detail = destination.pathname === '/' ? '\u00a0' : destination.pathname;
  if (preview?.title) detail = destination.hostname;
  return (
    <span
      ref={ref}
      className={compact ? styles.row : styles.blockAction}
      contentEditable={false}
      data-link-presentation=""
      onPointerDown={preventEditorFocus}
      onMouseDown={preventEditorFocus}
      onClick={(event) => event.stopPropagation()}
      onAuxClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {compact && (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          className={styles.destination}
          data-link-row={link.label}
        >
          <LinkPreviewThumbnail image={preview?.image} kind={kind} />
          <span className={styles.text}>
            <span className={styles.title} dir="auto">
              {name}
            </span>
            <span className={styles.subtitle} dir="ltr">
              {detail}
            </span>
          </span>
        </a>
      )}
      <button
        type="button"
        className={compact ? styles.iconButton : styles.previewButton}
        data-link-preview-control=""
        aria-label={compact ? t('previewNamedLink', { name }) : undefined}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        onClick={(event) => onPreview(links, event.currentTarget)}
      >
        <Eye size={16} aria-hidden="true" />
        {!compact &&
          (links.length === 1 ? t('previewLink') : t('previewLinks', { count: links.length }))}
      </button>
    </span>
  );
}
