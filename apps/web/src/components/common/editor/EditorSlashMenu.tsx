import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
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
  const [activeIndex, setActiveIndex] = useState(0);

  // Typing narrows the list, which can leave the highlight past its end.
  useEffect(() => setActiveIndex(0), [items]);

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

  if (items.length === 0) return null;

  return (
    <div className="w-44 overflow-hidden rounded-md border bg-popover p-1 shadow-md">
      {items.map((item, index) => (
        <button
          key={item.title}
          type="button"
          // The caret must stay in the typed "/query": the command deletes it.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command(item)}
          onMouseEnter={() => setActiveIndex(index)}
          className={cn(
            'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm [&_svg]:size-4 [&_svg]:text-muted-foreground',
            index === activeIndex && 'bg-accent text-accent-foreground',
          )}
        >
          <item.icon />
          {item.title}
        </button>
      ))}
    </div>
  );
}
