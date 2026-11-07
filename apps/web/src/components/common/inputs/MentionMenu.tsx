import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MentionCandidate } from '@/lib/api/endpoints/mentions';

export type MentionMenuHandle = { onKeyDown: (event: { key: string }) => boolean };

// The list shown after typing "@", in an editor and in a comment box alike: who can be
// mentioned, by name and by the handle the mention is written with. The arrow keys
// move the highlight and Enter or Tab picks it; Escape is left to the owner of the
// text, which closes the menu.
export default function MentionMenu({
  items,
  onPick,
  className,
  ref,
}: {
  items: MentionCandidate[];
  onPick: (item: MentionCandidate) => void;
  className?: string;
  ref?: Ref<MentionMenuHandle>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Typing narrows the list, which can leave the highlight past its end.
  useEffect(() => setActiveIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ key }) => {
      if (items.length === 0) return false;
      switch (key) {
        case 'ArrowDown':
          setActiveIndex((index) => (index + 1) % items.length);
          return true;
        case 'ArrowUp':
          setActiveIndex((index) => (index - 1 + items.length) % items.length);
          return true;
        case 'Enter':
        case 'Tab': {
          const item = items[activeIndex];
          if (item) onPick(item);
          return true;
        }
        default:
          return false;
      }
    },
  }));

  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        'max-h-64 w-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        className,
      )}
    >
      {items.map((item, index) => (
        <button
          key={item.userId}
          type="button"
          // Keeps the caret in the typed "@query", which the pick replaces.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(item)}
          onMouseEnter={() => setActiveIndex(index)}
          className={cn(
            'flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm',
            index === activeIndex && 'bg-accent text-accent-foreground',
          )}
        >
          {item.kind === 'agent' ? (
            <Bot className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <User className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{item.name}</span>
          <span className="truncate text-xs text-muted-foreground">@{item.username}</span>
        </button>
      ))}
    </div>
  );
}
