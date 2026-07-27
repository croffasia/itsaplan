import { type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type TimelineRange } from '../../services/comments.service';
import IssueTimelineItems from './IssueTimelineItems';

// The popover both timeline shapes open: a heading of what was clicked, and the feed
// entries of the stretches it covers, fetched once it is open.

export default function IssueTimelineItemsPopover({
  issueId,
  title,
  duration,
  subtitle,
  ranges,
  imageByUserId,
  children,
}: {
  issueId: number;
  title: string;
  duration: string;
  subtitle: string;
  ranges: TimelineRange[];
  imageByUserId: Map<string, string | null>;
  // The bar or share that opens the popover.
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="max-h-96 w-88 overflow-y-auto">
        <div className="mb-3 border-b pb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{title}</span>
            {duration && <span className="text-xs text-muted-foreground">{duration}</span>}
          </div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        <IssueTimelineItems issueId={issueId} ranges={ranges} imageByUserId={imageByUserId} />
      </PopoverContent>
    </Popover>
  );
}
