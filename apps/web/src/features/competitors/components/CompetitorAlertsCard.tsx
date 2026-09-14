import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CompetitorEvent } from '@/lib/api';
import { EVENT_LABEL, PLATFORM_META, formatClock } from '../utils/competitors';

export default function CompetitorAlertsCard({
  events,
  unread,
  canEdit,
  onMarkRead,
}: {
  events: CompetitorEvent[];
  unread: number;
  canEdit: boolean;
  onMarkRead: () => void;
}) {
  return (
    <Card className="gap-3 py-5 shadow-none">
      <CardHeader className="flex grid-cols-none flex-row items-baseline justify-between px-5">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Alerts
        </CardTitle>
        {canEdit && unread > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs font-normal"
            onClick={onMarkRead}
          >
            Mark {unread} read
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-5">
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No alerts yet. They appear here when a watched account posts, changes its profile, or
            its following jumps.
          </p>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => {
              const meta = PLATFORM_META[event.platform];
              return (
                <li key={event.id} className="flex gap-3 text-sm">
                  <span
                    className={cn(
                      'mt-1.5 size-1.5 shrink-0 rounded-full',
                      event.readAt ? 'bg-muted-foreground/40' : 'bg-foreground',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <meta.icon className="size-3 shrink-0 text-muted-foreground" />
                      <span className="truncate text-xs font-medium">@{event.handle}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {EVENT_LABEL[event.kind] ?? event.kind}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {event.summary}
                    </span>
                    {event.postUrl && (
                      <a
                        href={event.postUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium hover:underline"
                      >
                        Open post
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatClock(event.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
