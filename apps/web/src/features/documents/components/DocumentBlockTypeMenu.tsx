'use client';

import type { Editor } from '@tiptap/react';
import { Check, ChevronDown, Pilcrow } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const BLOCKS = [
  { key: 'text', level: null, preview: 'Aa' },
  { key: 'heading1', level: 1, preview: 'H1' },
  { key: 'heading2', level: 2, preview: 'H2' },
  { key: 'heading3', level: 3, preview: 'H3' },
  { key: 'heading4', level: 4, preview: 'H4' },
  { key: 'heading5', level: 5, preview: 'H5' },
  { key: 'heading6', level: 6, preview: 'H6' },
] as const;

type Block = (typeof BLOCKS)[number];

function activeBlock(editor: Editor): Block {
  return (
    BLOCKS.find(
      (block) => block.level !== null && editor.isActive('heading', { level: block.level }),
    ) ?? BLOCKS[0]
  );
}

export default function DocumentBlockTypeMenu({ editor }: { editor: Editor }) {
  const t = useTranslations('documents.toolbar');
  const active = activeBlock(editor);

  const select = (block: Block) => {
    const chain = editor.chain().focus();
    if (block.level === null) chain.setParagraph().run();
    else chain.toggleHeading({ level: block.level }).run();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 min-w-[7.75rem] justify-between gap-2 rounded-lg px-2.5 text-xs font-medium text-foreground hover:bg-muted data-[state=open]:bg-muted"
          aria-label={t(active.key)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Pilcrow className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{t(active.key)}</span>
          </span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-1.5">
        {BLOCKS.map((block) => (
          <DropdownMenuItem
            key={block.key}
            className="h-9 gap-3 rounded-md px-2.5"
            onSelect={() => select(block)}
          >
            <span className="w-7 shrink-0 font-mono text-[11px] font-semibold text-muted-foreground">
              {block.preview}
            </span>
            <span className="flex-1">{t(block.key)}</span>
            {active.key === block.key && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
