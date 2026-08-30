import { useEffect, useState, type RefObject } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Avatar from '@/components/common/Avatar';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { cn } from '@/lib/utils';
import { useLastComment } from '../../hooks/useLastComment';
import { commentPreview } from '../../utils/commentPreview';

const SHOW_MS = 5000;

// The newest comment, shortened to two lines, rising at the bottom of the issue the
// first time the activity feed goes off screen and fading out a few seconds later or
// when closed; clicking it scrolls the comment in. The wrapper has no height, so it
// does not move the content it sits over.
export default function LastCommentBubble({
  issueId,
  feedRef,
  imageByUserId,
}: {
  issueId: number;
  // The feed section to watch: the bubble stands in for it only while it is off screen.
  feedRef: RefObject<HTMLDivElement | null>;
  imageByUserId: Map<string, string | null>;
}) {
  const t = useTranslations('issue.comments');
  const tCommon = useTranslations('common');
  const relativeTime = useRelativeTime();
  const comment = useLastComment(issueId);
  const preview = commentPreview(comment?.body ?? '');
  // One turn per mounted issue: it waits for the feed to leave the screen, runs its few
  // seconds, and is then done for good. Starting in 'waiting' keeps the bubble off an
  // issue short enough to show its feed without scrolling.
  const [turn, setTurn] = useState<'waiting' | 'running' | 'done'>('waiting');
  // Nothing to show until the comment is loaded, and a turn that started without it
  // would run out while the bubble renders nothing.
  const ready = Boolean(comment && preview);

  // The feed leaving the screen starts the turn; reaching the feed ends it, since the
  // comment is right there to read.
  useEffect(() => {
    const el = feedRef.current;
    if (!el || !ready) return;
    const observer = new IntersectionObserver(([entry]) =>
      setTurn((current) => {
        if (current === 'waiting' && !entry.isIntersecting) return 'running';
        if (current === 'running' && entry.isIntersecting) return 'done';
        return current;
      }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [feedRef, ready]);

  // Tied to the turn, not the scroll: a turn that ends early is over for good, and the
  // bubble does not come back when the feed goes off screen again.
  useEffect(() => {
    if (turn !== 'running') return;
    const timer = setTimeout(() => setTurn('done'), SHOW_MS);
    return () => clearTimeout(timer);
  }, [turn]);

  if (!comment || !preview) return null;

  const author = comment.actorName ?? t('unknownAuthor');
  const image = (comment.actorUserId && imageByUserId.get(comment.actorUserId)) ?? null;
  const shown = turn === 'running';

  return (
    // z-50 and the end edge put it over the floating chat button at z-40.
    <div className="pointer-events-none sticky bottom-4 z-50 h-0" aria-hidden={!shown}>
      <div className="flex -translate-y-full justify-end">
        <div
          className={cn(
            // Same fill, outline and radius as a comment in the feed, on an opaque
            // background because it floats over the page.
            'flex max-w-sm items-start gap-1 rounded-lg border border-black/4 bg-background py-2 ps-3 pe-2 shadow-[var(--overlay-shadow)] transition duration-300 ease-out hover:bg-muted/40 motion-reduce:transition-none dark:border-white/8',
            // Hidden by opacity rather than unmounted, so a turn that ends fades out
            // as it came in.
            shown ? 'pointer-events-auto translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          )}
        >
          <button
            type="button"
            title={t('goToLastComment')}
            tabIndex={shown ? undefined : -1}
            className="flex min-w-0 gap-2.5 rounded-sm text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            onClick={() => {
              // The comment is missing from the DOM when the feed has not rendered it
              // (it pages 25 entries at a time); the feed itself is the fallback.
              const target = document.getElementById(`feed-item-${comment.id}`) ?? feedRef.current;
              target?.scrollIntoView({ block: 'center' });
            }}
          >
            <Avatar name={author} image={image} className="mt-0.5 size-5 text-[10px]" />
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium">{author}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  · {relativeTime(comment.createdAt)}
                </span>
              </span>
              <span dir="auto" className="line-clamp-2 text-sm text-foreground/85">
                {preview}
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-label={tCommon('close')}
            title={tCommon('close')}
            tabIndex={shown ? undefined : -1}
            className="rounded-sm p-0.5 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            onClick={() => setTurn('done')}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
