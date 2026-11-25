import { memo, useMemo, useRef, useState } from 'react';
import { useLinkInputCapabilities } from './useLinkInputCapabilities';
import { blockLinks, copyPresentedLinks } from './staticLinkPresentation';
import { isElement } from './markdownBlocks';
import LinkPreviewDialog, { type LinkPreviewItem } from './LinkPreviewDialog';
import MarkdownLinkBlock from './MarkdownLinkBlock';

function MarkdownLinkContent({
  nodes,
  bareUrls,
  complete,
}: {
  nodes: ChildNode[];
  bareUrls: ReadonlySet<string>;
  complete: boolean;
}) {
  const capabilities = useLinkInputCapabilities();
  const ref = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<{
    links: LinkPreviewItem[];
    trigger: HTMLButtonElement;
  } | null>(null);
  const presented = complete && capabilities.explicit;
  const blocks = useMemo(
    () =>
      nodes.map((node) => ({
        node,
        presentation:
          presented && isElement(node) ? blockLinks(node, bareUrls, window.location.origin) : null,
      })),
    [nodes, bareUrls, presented],
  );
  const last = nodes.findLast(isElement);
  return (
    <div ref={ref} className="md-content" tabIndex={-1} onCopy={copyPresentedLinks}>
      {blocks.map(({ node, presentation }, index) => {
        if (!isElement(node)) return node.textContent;
        return (
          <MarkdownLinkBlock
            // The opening tag: an answer is re-split on every streamed token, and a block
            // that turned into another element has to be mounted anew.
            key={`${index}${(node.cloneNode(false) as Element).outerHTML}`}
            element={node}
            writing={!complete && node === last}
            presentation={presentation}
            compact={capabilities.compact}
            expanded={!!dialog && dialog.links === presentation?.links}
            onPreview={(links, trigger) => setDialog({ links, trigger })}
          />
        );
      })}
      {dialog && (
        <LinkPreviewDialog {...dialog} container={ref.current} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

// The transcript renders on every streamed token, and only the answer being written changes.
export default memo(MarkdownLinkContent);
