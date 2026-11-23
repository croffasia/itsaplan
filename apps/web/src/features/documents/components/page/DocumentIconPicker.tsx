'use client';

import { useState } from 'react';
import { SmilePlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const FREQUENT_ICONS = ['📄', '✍️', '📘', '💭', '🧩', '🚀', '✅', '📍', '🎯', '🧪', '🗓️', '📊'];
// prettier-ignore
const MORE_ICONS = [
  '📣', '🗃️', '📎', '🔗', '🔐', '🗝️', '⚙️', '🧰', '💻', '📱', '🎨', '🗺️', '🔬', '🧬', '📝', '📐',
  '⭐', '❤️', '🔥', '⚡', '✨', '🎉', '🏁', '🚧', '⚠️', '❓', '💬', '👀', '👍', '🌱', '🌍', '💎',
];

// The first character of the text when it is an emoji, so a pasted word is refused.
function pastedEmoji(text: string): string | null {
  const first = [...new Intl.Segmenter().segment(text.trim())][0]?.segment;
  return first && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(first) ? first : null;
}

// Without an icon the trigger is an "Add icon" button above the title, shown while the
// pointer is over the title area.
export default function DocumentIconPicker({
  icon,
  editable,
  onChange,
}: {
  icon: string | null;
  editable: boolean;
  onChange: (icon: string | null) => void;
}) {
  const t = useTranslations('documents');
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState('');

  if (!editable) {
    return icon ? (
      <span
        className="-ms-2 grid size-13 shrink-0 place-items-center text-[34px] leading-none"
        aria-hidden
      >
        {icon}
      </span>
    ) : null;
  }

  const pick = (next: string | null) => {
    onChange(next);
    setOpen(false);
  };
  const option = (candidate: string) => (
    <button
      key={candidate}
      type="button"
      className="grid size-8 place-items-center rounded-md text-lg leading-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-primary/15"
      aria-label={candidate}
      aria-pressed={icon === candidate}
      onClick={() => pick(candidate)}
    >
      {candidate}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {icon ? (
          <button
            type="button"
            className="-ms-2 grid size-13 shrink-0 place-items-center rounded-lg text-[34px] leading-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={t('changeIcon')}
            title={t('changeIcon')}
          >
            {icon}
          </button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute -start-2.5 -top-9 h-7 px-2.5 text-[13px] text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100 focus-visible:opacity-100 has-[>svg]:px-2.5 aria-expanded:opacity-100"
          >
            <SmilePlus />
            {t('addIcon')}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2" aria-label={t('pageIcon')}>
        <div className="grid grid-cols-[repeat(8,32px)] gap-0.5" dir="ltr">
          {FREQUENT_ICONS.map(option)}
          <span className="col-span-full my-1 h-px bg-border" aria-hidden />
          {MORE_ICONS.map(option)}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const emoji = pastedEmoji(pasted);
            if (!emoji) {
              event.currentTarget.querySelector('input')?.select();
              return;
            }
            setPasted('');
            pick(emoji);
          }}
        >
          <Input
            value={pasted}
            className="h-8 min-w-0 flex-1 bg-muted text-[13px] shadow-none"
            placeholder={t('customIcon')}
            aria-label={t('customIcon')}
            autoComplete="off"
            onChange={(event) => setPasted(event.target.value)}
          />
          <Button type="submit" size="sm" className="h-8">
            {t('setIcon')}
          </Button>
        </form>
        {icon && (
          <>
            <div className="-mx-2 my-1 h-px bg-border" />
            <button
              type="button"
              className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-start text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              onClick={() => pick(null)}
            >
              <X className="size-4 text-muted-foreground" />
              {t('removeIcon')}
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
