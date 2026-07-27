import { type TimelineLayout } from '../../utils/timeline';
import IssueTimelineLane from './IssueTimelineLane';

// One lane per status the issue passed through, its stretches placed on a shared
// time axis, so a status entered twice shows as two bars in the same lane. Clicking
// a bar opens what happened while the issue was there.

export default function IssueTimelineLanes({
  issueId,
  layout,
  imageByUserId,
}: {
  issueId: number;
  layout: TimelineLayout;
  imageByUserId: Map<string, string | null>;
}) {
  return (
    <div className="@container">
      <div className="flex flex-col gap-1.5">
        {layout.lanes.map((lane) => (
          <IssueTimelineLane
            key={lane.label}
            issueId={issueId}
            lane={lane}
            hasFixedTail={layout.hasFixedTail}
            imageByUserId={imageByUserId}
          />
        ))}
      </div>
      {/* The axis sits under the tracks only, so it is inset by the label and total
          columns at the width where those are beside the track, and by the fixed bar
          past its end. */}
      <div className={`mt-1 @md:pl-31 ${layout.hasFixedTail ? 'pr-12 @md:pr-25' : '@md:pr-13'}`}>
        <div className="relative h-4 text-[10px] text-muted-foreground">
          {layout.ticks.map((tick) => (
            <span
              key={tick.leftPct}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${tick.leftPct}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
