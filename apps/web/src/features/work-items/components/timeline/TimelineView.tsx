import { Fragment, useRef, useState } from 'react';
import { buildMaps, issueColor, type WorkItemsViewProps } from '@/utils/project';
import { usePermissions } from '@/hooks/usePermissions';
import { useElementWidth } from '@/hooks/useElementWidth';
import { useTimelineLabelWidth } from '@/hooks/useTimelineLabelWidth';
import { LABEL_NARROW_W } from '@/utils/timelineTrack';
import { TimelineHeader } from '@/components/common/timeline/TimelineHeader';
import { TimelineLabelResizer } from '@/components/common/timeline/TimelineLabelResizer';
import { useTimelineDrag } from '../../hooks/useTimelineDrag';
import { buildTimeline, labelWidthKey, SCALE_DAY_W } from '../../utils/timeline';
import { TimelineGroupRow } from './TimelineGroupRow';
import { TimelineIssueRow } from './TimelineIssueRow';
import { TimelineLinkRows } from './TimelineLinkRows';
import { TimelineSubtaskRows } from './TimelineSubtaskRows';

interface TimelineViewProps extends WorkItemsViewProps {
  collapsedGroups?: Set<string>;
  onToggleGroup?: (groupKey: string) => void;
  // The saved view the timeline is open on, which scopes the label width. Absent
  // where there are no view tabs (an initiative's issues, a public share).
  viewId?: number | null;
}

export default function TimelineView({
  project,
  settings,
  onOpenIssue,
  collapsedGroups,
  onToggleGroup,
  viewId,
  readOnly,
}: TimelineViewProps) {
  const { can } = usePermissions(project);
  const barsReadOnly = readOnly || !can('work_items', 'edit');
  const [localCollapsedGroups, setLocalCollapsedGroups] = useState<Set<string>>(new Set());
  const activeCollapsedGroups = collapsedGroups ?? localCollapsedGroups;
  const toggleGroup =
    onToggleGroup ??
    ((groupKey: string) => {
      setLocalCollapsedGroups((current) => {
        const next = new Set(current);
        if (next.has(groupKey)) next.delete(groupKey);
        else next.add(groupKey);
        return next;
      });
    });
  const DAY_W = SCALE_DAY_W[settings.timelineScale];
  const { width: titleWidth, setWidth: setTitleWidth } = useTimelineLabelWidth(
    labelWidthKey(project.project.key, viewId ?? null),
  );
  const maps = buildMaps(project);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { preview, dropGroupKey, beginDrag } = useTimelineDrag({
    project,
    group: settings.group,
    dayW: DAY_W,
    onOpenIssue,
  });
  // Width of the scroll area, so the track can extend with trailing days until it
  // fills the viewport instead of leaving empty space on the right.
  const viewportW = useElementWidth(scrollRef);

  // Narrow the sticky label column on small screens so the day track is usable;
  // on wider ones it is the width the grip was dragged to.
  const narrow = viewportW < 640;
  const labelW = narrow ? LABEL_NARROW_W : titleWidth;
  const { rows, days, months, trackWidth, todayLeft, todayInRange, dayLines, spanToRect } =
    buildTimeline({
      project,
      group: settings.group,
      showEmptyGroups: settings.showEmptyGroups,
      collapsedGroups: activeCollapsedGroups,
      viewportW,
      labelW,
      dayW: DAY_W,
    });

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <div className="relative" style={{ width: labelW + trackWidth }}>
        <TimelineHeader
          labelW={labelW}
          trackWidth={trackWidth}
          dayW={DAY_W}
          months={months}
          days={days}
        />
        {!narrow && <TimelineLabelResizer labelW={labelW} onResize={setTitleWidth} />}

        {rows.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No issues to place on the timeline yet.
          </div>
        )}

        {rows.map((row) => {
          if (row.kind === 'group') {
            return (
              <TimelineGroupRow
                key={`g-${row.group.key}`}
                group={row.group}
                count={row.count}
                collapsed={row.collapsed}
                aggregateRect={
                  row.aggregateSpan
                    ? spanToRect(row.aggregateSpan.start, row.aggregateSpan.end)
                    : null
                }
                labelW={labelW}
                trackWidth={trackWidth}
                isDrop={dropGroupKey === row.group.key}
                onToggle={() => toggleGroup(row.group.key)}
              />
            );
          }

          const { issue, span } = row;
          const active = preview?.issueId === issue.id;
          const rect = spanToRect(
            active ? preview!.start : span.start,
            active ? preview!.end : span.end,
          );
          return (
            <Fragment key={issue.id}>
              <TimelineIssueRow
                project={project}
                issue={issue}
                maps={maps}
                span={span}
                rect={rect}
                color={issueColor(issue, maps)}
                active={active}
                isDrop={dropGroupKey === row.groupKey}
                groupKey={row.groupKey}
                labelW={labelW}
                trackWidth={trackWidth}
                dayLines={dayLines}
                todayInRange={todayInRange}
                todayLeft={todayLeft}
                readOnly={barsReadOnly}
                onBeginDrag={beginDrag}
                onOpen={onOpenIssue}
              />
              <TimelineSubtaskRows
                issueId={issue.id}
                groupKey={row.groupKey}
                maps={maps}
                labelW={labelW}
                trackWidth={trackWidth}
                dayLines={dayLines}
                todayInRange={todayInRange}
                todayLeft={todayLeft}
                spanToRect={spanToRect}
                onOpen={onOpenIssue}
              />
              <TimelineLinkRows
                links={issue.links}
                groupKey={row.groupKey}
                maps={maps}
                labelW={labelW}
                trackWidth={trackWidth}
                dayLines={dayLines}
                todayInRange={todayInRange}
                todayLeft={todayLeft}
                spanToRect={spanToRect}
                onOpen={onOpenIssue}
              />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
