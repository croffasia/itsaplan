import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ArrowDown, ArrowUp, Copy, GripVertical, Link2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { copyText } from '@/utils/clipboard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { changeDocumentBlock, documentBlockRange } from '../utils/documentBlocks';

const HANDLE = 24;

// The handle beside the block under the pointer, or under the cursor while typing. A
// heading carries its section: the blocks below it up to the next heading of the same
// or a higher level.
export default function DocumentBlockMenu({ editor }: { editor: Editor }) {
  const t = useTranslations('documents.blocks');
  const [position, setPosition] = useState(1);
  const [top, setTop] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  const positionRef = useRef(position);
  positionRef.current = position;

  useEffect(() => {
    const container = editor.view.dom.closest('[data-document-editor]');
    const place = (at: number) => {
      const range = documentBlockRange(editor, at);
      const node = range && editor.view.nodeDOM(range.from);
      if (!(node instanceof HTMLElement) || !container) return;
      const line = Number.parseFloat(getComputedStyle(node).lineHeight) || HANDLE;
      setPosition(at);
      setTop(
        node.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          Math.max(0, (line - HANDLE) / 2),
      );
    };
    const hover = (event: MouseEvent) => {
      if (openRef.current) return;
      const hit = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (hit) place(hit.inside >= 0 ? hit.inside : hit.pos);
    };
    const selection = () => {
      if (!openRef.current) place(editor.state.selection.from);
    };
    const resize = new ResizeObserver(() => place(positionRef.current));
    editor.view.dom.addEventListener('mousemove', hover);
    editor.on('selectionUpdate', selection);
    resize.observe(editor.view.dom);
    return () => {
      editor.view.dom.removeEventListener('mousemove', hover);
      editor.off('selectionUpdate', selection);
      resize.disconnect();
    };
  }, [editor]);

  if (top === null) return null;
  const range = documentBlockRange(editor, position);
  return (
    // As wide as the gap to the text, so the pointer stays over the editor on its way here.
    <div
      className={cn(
        'absolute -start-10 z-20 w-10 opacity-0 transition-opacity group-focus-within/doc:opacity-100 group-hover/doc:opacity-100 max-[860px]:-start-7 max-[860px]:w-7 print:hidden',
        open && 'opacity-100',
      )}
      style={{ top }}
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('actions')}
            title={t('actions')}
            className="grid size-6 place-items-center rounded-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-accent aria-expanded:text-foreground"
          >
            <GripVertical className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-50">
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!range?.node.attrs.blockId}
            onSelect={() => {
              const url = new URL(window.location.href);
              url.hash = `block-${range?.node.attrs.blockId}`;
              void copyText(url.toString()).then((copied) =>
                copied ? toast.success(t('linkCopied')) : toast.error(t('copyFailed')),
              );
            }}
          >
            <Link2 />
            {t('copyLink')}
          </DropdownMenuItem>
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
