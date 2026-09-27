import { useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useEditorLinkPreview } from './useEditorLinkPreview';
import { useLinkPreviewQuery } from './useLinkPreviewQuery';
import EditorLinkPreviewCard from './EditorLinkPreviewCard';
import LinkPreviewDialog from './LinkPreviewDialog';
import { useEditorLinkPresentation } from './useEditorLinkPresentation';
import styles from './EditorLinkPreview.module.css';

export default function EditorLinkPreview({
  editor,
  source = '',
  compact = true,
}: {
  editor: Editor;
  source?: string;
  compact?: boolean;
}) {
  const t = useTranslations('common.editor');
  const { dialog, closeDialog } = useEditorLinkPresentation(editor, source, compact);
  const { anchor, candidateAnchor, open, close, keepOpen, leave } = useEditorLinkPreview(
    editor,
    !!dialog,
  );
  const virtualRef = useRef({ getBoundingClientRect: () => new DOMRect() });
  virtualRef.current.getBoundingClientRect = () => anchor?.getBoundingClientRect() ?? new DOMRect();
  useLinkPreviewQuery(candidateAnchor?.href);
  const { data, isPending } = useLinkPreviewQuery(anchor?.href);
  if (dialog)
    return <LinkPreviewDialog {...dialog} onClose={closeDialog} container={editor.view.dom} />;
  if (!anchor) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        side="top"
        align="start"
        sideOffset={10}
        collisionPadding={12}
        aria-label={t('linkPreview')}
        className={`${styles.preview} w-80 max-w-[calc(100vw-24px)] rounded-2xl border-0 bg-popover p-1 text-popover-foreground`}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={keepOpen}
        onPointerLeave={leave}
        onFocusCapture={keepOpen}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) leave();
        }}
      >
        <EditorLinkPreviewCard url={anchor.href} preview={data} loading={isPending} />
      </PopoverContent>
    </Popover>
  );
}
