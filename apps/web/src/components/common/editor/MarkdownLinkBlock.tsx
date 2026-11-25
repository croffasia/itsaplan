import LinkBlockControls from './LinkBlockControls';
import type { LinkPreviewItem } from './LinkPreviewDialog';
import MarkdownBlock from './MarkdownBlock';
import MarkdownCodeBlock from './MarkdownCodeBlock';
import { codeOf, isLead } from './markdownBlocks';
import type { BlockLinks } from './staticLinkPresentation';
import styles from './LinkPresentation.module.css';

// A block of rendered markdown with the preview controls of its links, where the reader's
// input has no hover to show a preview on.
export default function MarkdownLinkBlock({
  element,
  writing,
  presentation,
  compact,
  expanded,
  onPreview,
}: {
  element: Element;
  writing: boolean;
  presentation: BlockLinks | null;
  compact: boolean;
  expanded: boolean;
  onPreview: (links: LinkPreviewItem[], trigger: HTMLButtonElement) => void;
}) {
  const bare = compact && !!presentation?.bare;
  const controls = !!presentation?.links.length && (
    <LinkBlockControls
      links={presentation.links}
      compact={bare}
      expanded={expanded}
      onPreview={onPreview}
    />
  );
  if (bare) {
    return (
      <div>
        <div
          data-link-original=""
          className={styles.original}
          dangerouslySetInnerHTML={{ __html: element.outerHTML }}
        />
        {controls}
      </div>
    );
  }
  const code = codeOf(element);
  return (
    <>
      {code ? (
        <MarkdownCodeBlock {...code} writing={writing} />
      ) : (
        <MarkdownBlock
          element={element}
          // Text may still follow the bold of a paragraph being written.
          className={!writing && isLead(element) ? 'md-lead' : undefined}
        />
      )}
      {controls}
    </>
  );
}
