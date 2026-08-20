import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type MentionCandidate } from '@/lib/tiptap-mention';

export type MentionMenuRef = { onKeyDown: (props: { event: KeyboardEvent }) => boolean };

// The list shown after typing "@": who can be mentioned, by name and by the handle
// the mention is written with. Escape is handled by the suggestion plugin.
export default function EditorMentionMenu({
  items,
  command,
  ref,
}: {
  items: MentionCandidate[];
  command: (item: MentionCandidate) => void;
  ref?: Ref<MentionMenuRef>;
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
        case 'Enter':
        case 'Tab': {
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
    <div className="max-h-64 w-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
      {items.map((item, index) => (
        <button
          key={item.userId}
          type="button"
          // The caret must stay in the typed "@query": the command replaces it.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command(item)}
          onMouseEnter={() => setActiveIndex(index)}
          className={cn(
            'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
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
