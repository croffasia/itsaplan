import { useFormatter, useTranslations } from 'next-intl';
import type { CommentReaction } from '@/lib/api/endpoints/activity';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import CommentReactionPicker from './CommentReactionPicker';
import { reactedEmojis } from '../../utils/reactions';

// A comment without reactions shows the picker here only on a narrow screen: a wide
// one has it in the comment's action row.

const CHIP = 'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs tabular-nums';

export default function CommentReactions({
  reactions,
  viewerId,
  onToggle,
}: {
  reactions: CommentReaction[];
  viewerId?: string;
  // Left out where reacting is not offered: the timeline popover, and a member who
  // may not comment.
  onToggle?: (emoji: string) => void;
}) {
  const t = useTranslations('issue.comments');
  const format = useFormatter();
  if (reactions.length === 0 && !onToggle) return null;

  const mine = reactedEmojis(reactions, viewerId);

  return (
    <div
      role="group"
      aria-label={t('reactions')}
      className={cn('mt-1.5 flex flex-wrap gap-1 ps-8.5', reactions.length === 0 && 'sm:hidden')}
    >
      {reactions.map((reaction) => {
        const label = t('reactedBy', {
          names: format.list(reaction.users.map((u) => u.name)),
          emoji: reaction.emoji,
        });
        const content = (
          <>
            <span aria-hidden className="text-sm leading-none">
              {reaction.emoji}
            </span>
            {reaction.users.length}
          </>
        );
        return (
          <Tooltip key={reaction.emoji}>
            <TooltipTrigger asChild>
              {onToggle ? (
                <button
                  type="button"
                  aria-label={label}
                  aria-pressed={mine.includes(reaction.emoji)}
                  onClick={() => onToggle(reaction.emoji)}
                  className={cn(
                    CHIP,
                    'outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                    'aria-pressed:border-primary/40 aria-pressed:bg-primary/10',
                  )}
                >
                  {content}
                </button>
              ) : (
                <span role="img" aria-label={label} tabIndex={0} className={CHIP}>
                  {content}
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{label}</TooltipContent>
          </Tooltip>
        );
      })}
      {onToggle && <CommentReactionPicker selected={mine} onPick={onToggle} />}
    </div>
  );
}
