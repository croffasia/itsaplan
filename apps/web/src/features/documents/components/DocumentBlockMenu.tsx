import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ArrowDown, ArrowUp, Copy, GripVertical, Link2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { changeDocumentBlock, documentBlockRange } from '../utils/documentBlocks';

export default function DocumentBlockMenu({ editor }: { editor: Editor }) {
  const t = useTranslations('documents.blocks');
  const [position, setPosition] = useState(1);
  const [top, setTop] = useState(0);
  useEffect(() => {
    const update = () => {
      const position = editor.state.selection.from;
      setPosition(position);
      const range = documentBlockRange(editor, position);
      const node = range && editor.view.nodeDOM(range.from);
      const container = editor.view.dom.closest('[data-document-editor]');
      if (node instanceof HTMLElement && container)
        setTop(node.getBoundingClientRect().top - container.getBoundingClientRect().top);
    };
    editor.on('selectionUpdate', update);
    const resize = new ResizeObserver(update);
    resize.observe(editor.view.dom);
    update();
    return () => {
      editor.off('selectionUpdate', update);
      resize.disconnect();
    };
  }, [editor]);
  const range = documentBlockRange(editor, position);
  return (
    <div className="absolute -start-7 z-20 print:hidden" style={{ top }}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('actions')}
            className="size-7 text-muted-foreground"
          >
            <GripVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(['up', 'down', 'duplicate'] as const).map((action) => {
            const Icon = action === 'up' ? ArrowUp : action === 'down' ? ArrowDown : Copy;
            return (
              <DropdownMenuItem
                key={action}
                onSelect={() => changeDocumentBlock(editor, position, action)}
                disabled={
                  !range ||
                  (action === 'up' && range.from === 0) ||
                  (action === 'down' && range.to === editor.state.doc.content.size)
                }
              >
                <Icon />
                {t(action)}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuItem
            disabled={!range?.node.attrs.blockId}
            onSelect={() => {
              const url = new URL(window.location.href);
              url.hash = `block-${range?.node.attrs.blockId}`;
              void navigator.clipboard
                .writeText(url.toString())
                .then(() => toast.success(t('linkCopied')))
                .catch(() => toast.error(t('copyFailed')));
            }}
          >
            <Link2 />
            {t('copyLink')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => changeDocumentBlock(editor, position, 'delete')}
          >
            <Trash2 />
            {t('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
