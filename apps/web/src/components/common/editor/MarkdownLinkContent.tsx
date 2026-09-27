import { useMemo, useRef, useState } from 'react';
import { useLinkInputCapabilities } from './useLinkInputCapabilities';
import { copyPresentedLinks, staticLinkBlocks } from './staticLinkPresentation';
import LinkBlockControls from './LinkBlockControls';
import LinkPreviewDialog, { type LinkPreviewItem } from './LinkPreviewDialog';
import styles from './LinkPresentation.module.css';

export default function MarkdownLinkContent({
  html,
  bareUrls,
  complete,
}: {
  html: string;
  bareUrls: ReadonlySet<string>;
  complete: boolean;
}) {
  const capabilities = useLinkInputCapabilities();
  const ref = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<{
    links: LinkPreviewItem[];
    trigger: HTMLButtonElement;
  } | null>(null);
  const blocks = useMemo(
    () =>
      complete && capabilities.explicit
        ? staticLinkBlocks(html, bareUrls, window.location.origin)
        : null,
    [html, bareUrls, complete, capabilities.explicit],
  );
  return (
    <div ref={ref} className="md-content" tabIndex={-1} onCopy={copyPresentedLinks}>
      {blocks ? (
        blocks.map((block, index) => (
          <div
            key={index}
            className={
              block.bare && capabilities.compact ? styles.staticCompact : styles.staticBlock
            }
          >
            {!(block.bare && capabilities.compact) && (
              <div dangerouslySetInnerHTML={{ __html: block.html }} />
            )}
            {block.bare && capabilities.compact && (
              <div
                data-link-original=""
                className={styles.original}
                dangerouslySetInnerHTML={{ __html: block.html }}
              />
            )}
            {block.links.length > 0 && (
              <LinkBlockControls
                links={block.links}
                compact={block.bare && capabilities.compact}
                expanded={dialog?.links === block.links}
                onPreview={(links, trigger) => setDialog({ links, trigger })}
              />
            )}
          </div>
        ))
      ) : (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      )}
      {dialog && (
        <LinkPreviewDialog {...dialog} container={ref.current} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
