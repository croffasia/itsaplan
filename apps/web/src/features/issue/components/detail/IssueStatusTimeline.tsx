import { useState } from 'react';
import { type Column } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAccountPreferencesQuery } from '@/services/preferences.service';
import { useTimelineQuery } from '../../services/comments.service';
import { buildLifecycleMetrics, buildTimelineLayout } from '../../utils/timeline';
import IssueTimelineCompact from './IssueTimelineCompact';
import IssueTimelineLanes from './IssueTimelineLanes';
import IssueSectionHeading from './IssueSectionHeading';
import { useTranslations } from 'next-intl';

// How the issue moved through the statuses, above the activity log. The compact bar
// shows one share per status with the lifecycle metrics; the header button swaps in
// the timeline, where every stretch keeps its own place on a time axis. Both open the
// same entries on click, and the heading collapses the section.
//
// Which shape it starts in, and whether it starts expanded, come from the account
// preferences. Switching either here is deliberately not saved: it applies to the
// issue in front of the person and is gone when they leave it. Nothing renders until
// both the timeline and those preferences are loaded — a first paint from the
// defaults would collapse or swap the section a moment later.

export default function IssueStatusTimeline({
  issueId,
  columns,
  imageByUserId,
}: {
  issueId: number;
  // The project's columns, for the status colors and for reading which status counts
  // as started or completed: a segment carries the column name it was logged with,
  // not its id.
  columns: Column[];
  imageByUserId: Map<string, string | null>;
}) {
  const t = useTranslations('issue.stats');
  // Null until the person changes the shape on this issue, and then it wins over the
  // preference for as long as the issue stays open.
  const [openHere, setOpenHere] = useState<boolean | null>(null);
  const [timelineHere, setTimelineHere] = useState<boolean | null>(null);
  const timelineQuery = useTimelineQuery(issueId);
  const { data: prefs } = useAccountPreferencesQuery();
  const segments = timelineQuery.data ?? [];
  const layout = buildTimelineLayout(segments, columns, t('unknownStatus'));

  if (layout.lanes.length === 0 || !prefs) return null;

  const open = openHere ?? prefs.issueStatsOpen;
  const showTimeline = timelineHere ?? prefs.issueStatsView === 'timeline';
  return (
    // Collapsed, the row is all there is, so the section pulls itself up against the
    // activity log below: the heading would otherwise sit off-centre between the two
    // rules, its own padding above and the activity log's margin below.
    <div className={`mt-6 border-t pt-5 ${open ? '' : '-mb-2'}`}>
      {/* Fixed height: the view button only renders while the section is open, and
          without it the row would shrink to the height of the heading text. */}
      <div className={`flex h-7 items-center justify-between gap-3 ${open ? 'mb-4' : ''}`}>
        <IssueSectionHeading label={t('title')} open={open} onToggle={() => setOpenHere(!open)} />
        {open && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => setTimelineHere(!showTimeline)}
          >
            {showTimeline ? t('compact') : t('timeline')}
          </Button>
        )}
      </div>
      {/* The bars and the axis ticks are placed as a percentage from the left edge,
          and time runs left to right in every language, so the chart keeps its
          direction inside a mirrored page. */}
      {open && (
        <div dir="ltr">
          {showTimeline ? (
            <IssueTimelineLanes issueId={issueId} layout={layout} imageByUserId={imageByUserId} />
          ) : (
            <IssueTimelineCompact
              issueId={issueId}
              lanes={layout.lanes}
              metrics={buildLifecycleMetrics(segments, columns)}
              imageByUserId={imageByUserId}
            />
          )}
        </div>
      )}
    </div>
  );
}
