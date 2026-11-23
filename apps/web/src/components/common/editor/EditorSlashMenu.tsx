import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { type SlashItem } from '@/lib/tiptap-slash-command';

export type SlashMenuRef = { onKeyDown: (props: { event: KeyboardEvent }) => boolean };

// The list shown after typing "/". Escape is handled by the suggestion plugin.
export default function EditorSlashMenu({
  items,
  command,
  ref,
}: {
  items: SlashItem[];
  command: (item: SlashItem) => void;
  ref?: Ref<SlashMenuRef>;
}) {
  const t = useTranslations('common.editor');
  const [activeIndex, setActiveIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  // Typing narrows the list, which can leave the highlight past its end.
  useEffect(() => setActiveIndex(0), [items]);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      switch (event.key) {
        case 'ArrowDown':
          setActiveIndex((index) => (index + 1) % items.length);
          return true;
        case 'ArrowUp':
          setActiveIndex((index) => (index - 1 + items.length) % items.length);
          return true;
        case 'Enter': {
          const item = items[activeIndex];
          if (item) command(item);
          return true;
        }
        default:
          return false;
      }
    },
  }));

  // No match closes the menu: a typed path such as /usr/bin is text, not a command.
  if (items.length === 0) return null;

  return (
    <div
      ref={list}
      role="listbox"
      aria-label={t('blocks')}
      className="max-h-80 w-66 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-border/55 bg-popover p-1 text-popover-foreground shadow-[var(--overlay-shadow)]"
    >
      <p className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{t('blocks')}</p>
      {items.map((item, index) => (
        <button
          key={item.title}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          // The caret must stay in the typed "/query": the command deletes it.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command(item)}
          onMouseEnter={() => setActiveIndex(index)}
          className={cn(
            'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-start text-sm [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
            index === activeIndex && 'bg-accent text-accent-foreground',
          )}
        >
          <item.icon />
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          {item.hint && (
            <span className="font-mono text-xs text-muted-foreground" dir="ltr">
              {item.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
