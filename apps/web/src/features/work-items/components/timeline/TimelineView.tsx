import { useEffect, useRef, useState } from 'react';
import { buildMaps, issueColor, type WorkItemsViewProps } from '@/utils/project';
import { useTimelineDrag } from '../../hooks/useTimelineDrag';
import { buildTimeline, LABEL_W, SCALE_DAY_W } from '../../utils/timeline';
import { TimelineHeader } from './TimelineHeader';
import { TimelineGroupRow } from './TimelineGroupRow';
import { TimelineIssueRow } from './TimelineIssueRow';

interface TimelineViewProps extends WorkItemsViewProps {
  collapsedGroups?: Set<string>;
  onToggleGroup?: (groupKey: string) => void;
}

export default function TimelineView({
  project,
  settings,
  onOpenIssue,
  collapsedGroups,
  onToggleGroup,
}: TimelineViewProps) {
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
  const [viewportW, setViewportW] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportW(el.clientWidth));
    ro.observe(el);
    setViewportW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Narrow the sticky label column on small screens so the day track is usable.
  const labelW = viewportW < 640 ? 140 : LABEL_W;
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
      <div style={{ width: labelW + trackWidth }}>
        <TimelineHeader
          labelW={labelW}
          trackWidth={trackWidth}
          dayW={DAY_W}
          months={months}
          days={days}
        />

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
            <TimelineIssueRow
              key={issue.id}
              project={project}
              issue={issue}
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
              onBeginDrag={beginDrag}
              onOpen={onOpenIssue}
            />
          );
        })}
      </div>
    </div>
  );
}
