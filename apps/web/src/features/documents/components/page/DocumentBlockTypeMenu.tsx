'use client';

import type { Editor } from '@tiptap/react';
import {
  Check,
  ChevronDown,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Pilcrow,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const BLOCKS = [
  { key: 'text', level: null, icon: Pilcrow },
  { key: 'heading1', level: 1, icon: Heading1 },
  { key: 'heading2', level: 2, icon: Heading2 },
  { key: 'heading3', level: 3, icon: Heading3 },
  { key: 'heading4', level: 4, icon: Heading4 },
  { key: 'heading5', level: 5, icon: Heading5 },
  { key: 'heading6', level: 6, icon: Heading6 },
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
        <button
          type="button"
          aria-label={t('textStyle')}
          onMouseDown={(event) => event.preventDefault()}
          className="flex h-8 w-34 shrink-0 items-center gap-2 rounded-md px-2 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-accent"
        >
          <Pilcrow className="size-4 shrink-0 stroke-[1.75] text-muted-foreground" />
          <span className="min-w-0 truncate">{t(active.key)}</span>
          <ChevronDown className="ms-auto size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-50">
        {BLOCKS.map((block) => (
          <DropdownMenuItem key={block.key} onSelect={() => select(block)}>
            <block.icon />
            {t(block.key)}
            {active.key === block.key && <Check className="ms-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
