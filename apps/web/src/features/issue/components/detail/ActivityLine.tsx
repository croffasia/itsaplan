import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CircleDot } from 'lucide-react';
import type { FeedItem } from '@/lib/api/endpoints/activity';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDateTime } from '@/utils/dates';
import { ACTION_ICON } from '../../utils/activityIcons';
import { useActivityText } from '../../hooks/useActivityText';
import MarkdownEditor from '@/components/common/editor/MarkdownEditor';

// One change-log entry in an activity list: icon, actor, the sentence describing
// the change, and how long ago it happened. A change with a long value (a new
// description) puts it behind a "view" popover instead of inlining it. A `nested`
// line is one of a collapsed run opened under its first line, so it leaves the icon
// out. Used by the live feed, the shared read-only feed, and the timeline's
// per-status popover.

export default function ActivityLine({
  item,
  trailing,
  nested,
}: {
  item: FeedItem;
  trailing?: ReactNode;
  nested?: boolean;
}) {
  const t = useTranslations('issue');
  const relativeTime = useRelativeTime();
  const describeActivity = useActivityText();
  const Icon = (item.action && ACTION_ICON[item.action]) || CircleDot;
  const { line, popover } = describeActivity(item);
  const actor = item.actorName ?? t('system');
  return (
    <li className="flex items-start gap-2.5 py-1 text-[13px]">
      {nested ? (
        <span className="w-6 shrink-0" />
      ) : (
        <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-3.5" />
        </span>
      )}
      <span className="min-w-0 flex-1 pt-0.5 text-muted-foreground">
        <span className="font-medium text-foreground/85">{actor}</span> {line}
        {popover && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="ms-1.5 text-foreground/70 underline underline-offset-2 hover:text-foreground"
              >
                {t('viewValue')}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-80 w-96 overflow-y-auto">
              <MarkdownEditor className="text-sm" defaultValue={popover} editable={false} />
            </PopoverContent>
          </Popover>
        )}
        {trailing}
      </span>
      <span
        className="shrink-0 pt-0.5 text-xs text-muted-foreground/80 tabular-nums"
        title={formatDateTime(item.createdAt)}
      >
        {relativeTime(item.createdAt)}
      </span>
    </li>
  );
}
