import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { useTranslations } from 'next-intl';
import Avatar from '@/components/common/Avatar';
import { cn } from '@/lib/utils';
import type { MentionCandidate } from '@/lib/api/endpoints/mentions';

export type MentionMenuHandle = { onKeyDown: (event: { key: string }) => boolean };

// The list shown after typing "@", in an editor and in a comment box alike: who can be
// mentioned, members first and then agents, by name and by the handle the mention is
// written with. The arrow keys move the highlight and Enter or Tab picks it; Escape is
// left to the owner of the text, which closes the menu.
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
  const t = useTranslations('common.editor');
  const [activeIndex, setActiveIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const groups = useMemo(
    () =>
      [
        { label: t('mentionMembers'), items: items.filter((item) => item.kind !== 'agent') },
        { label: t('mentionAgents'), items: items.filter((item) => item.kind === 'agent') },
      ].filter((group) => group.items.length > 0),
    [items, t],
  );
  // The order the rows are drawn in, which the arrow keys follow.
  const ordered = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  // Typing narrows the list, which can leave the highlight past its end.
  useEffect(() => setActiveIndex(0), [items]);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ key }) => {
      if (ordered.length === 0) return false;
      switch (key) {
        case 'ArrowDown':
          setActiveIndex((index) => (index + 1) % ordered.length);
          return true;
        case 'ArrowUp':
          setActiveIndex((index) => (index - 1 + ordered.length) % ordered.length);
          return true;
        case 'Enter':
        case 'Tab': {
          const item = ordered[activeIndex];
          if (item) onPick(item);
          return true;
        }
        default:
          return false;
      }
    },
  }));

  if (ordered.length === 0) return null;

  return (
    <div
      ref={list}
      role="listbox"
      className={cn(
        'max-h-80 w-66 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-border/55 bg-popover p-1 text-popover-foreground shadow-[var(--overlay-shadow)]',
        className,
      )}
    >
      {groups.map((group) => (
        <div key={group.label} role="group" aria-label={group.label}>
          <p className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
            {group.label}
          </p>
          {group.items.map((item) => {
            const index = ordered.indexOf(item);
            return (
              <button
                key={item.userId}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                // Keeps the caret in the typed "@query", which the pick replaces.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(item)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-start text-sm',
                  index === activeIndex && 'bg-accent text-accent-foreground',
                )}
              >
                <Avatar name={item.name} className="size-4 text-[7px]" />
                <span className="min-w-0 truncate" dir="auto">
                  {item.name}
                </span>
                <span className="ms-auto min-w-0 truncate text-xs text-muted-foreground">
                  @{item.username}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
