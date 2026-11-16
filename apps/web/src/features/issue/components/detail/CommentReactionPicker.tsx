import { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { MORE_REACTION_EMOJIS, PINNED_REACTION_EMOJIS } from '../../utils/reactionEmojis';

// Picking an emoji the viewer already reacted with takes that reaction back.

export default function CommentReactionPicker({
  selected,
  onPick,
  className,
}: {
  // The emoji the viewer already reacted with.
  selected: string[];
  onPick: (emoji: string) => void;
  className?: string;
}) {
  const t = useTranslations('issue.comments');
  const [open, setOpen] = useState(false);

  const emojiButton = (emoji: string) => (
    <button
      key={emoji}
      type="button"
      aria-pressed={selected.includes(emoji)}
      onClick={() => {
        onPick(emoji);
        setOpen(false);
      }}
      className="flex size-8 items-center justify-center rounded-md text-lg leading-none outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-primary/15"
    >
      {emoji}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className={cn('h-6 px-2 text-xs text-muted-foreground', className)}
          title={t('addReaction')}
          aria-label={t('addReaction')}
        >
          <SmilePlus className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2" aria-label={t('addReaction')}>
        <div dir="ltr" className="grid grid-cols-8 gap-0.5">
          {PINNED_REACTION_EMOJIS.map(emojiButton)}
          <div className="col-span-full my-1 border-t" />
          {MORE_REACTION_EMOJIS.map(emojiButton)}
        </div>
      </PopoverContent>
    </Popover>
  );
}
