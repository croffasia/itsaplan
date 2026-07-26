import { formatDistanceToNow, parseISO } from 'date-fns';
import { CircleDot } from 'lucide-react';
import { type FeedItem } from '@/lib/api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ACTION_ICON, describeActivity } from '../../utils/activityText';
import IssueMarkdownEditor from '../editor/IssueMarkdownEditor';

// One change-log entry in an activity list: icon, actor, the sentence describing
// the change, and how long ago it happened. A change with a long value (a new
// description) puts it behind a "view" popover instead of inlining it. Used by the
// live feed, the shared read-only feed, and the timeline's per-status popover.

export default function ActivityLine({ item }: { item: FeedItem }) {
  const Icon = (item.action && ACTION_ICON[item.action]) || CircleDot;
  const { line, popover } = describeActivity(item);
  const actor = item.actorName ?? 'System';
  return (
    <li className="flex items-center gap-2.5 text-xs">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-3" />
      </span>
      <span className="min-w-0 text-muted-foreground">
        <span className="font-medium text-muted-foreground">{actor}</span> {line}
        {popover && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="ml-1.5 text-foreground/70 underline underline-offset-2 hover:text-foreground"
              >
                view
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-80 w-96 overflow-y-auto">
              <IssueMarkdownEditor className="text-sm" defaultValue={popover} editable={false} />
            </PopoverContent>
          </Popover>
        )}
        <span className="ml-1.5 text-xs">
          · {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}
        </span>
      </span>
    </li>
  );
}
