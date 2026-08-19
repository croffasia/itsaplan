import { useRef, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import { buildMaps, issueColor, type WorkItemsViewProps } from '@/utils/project';
import { usePermissions } from '@/hooks/usePermissions';
import { useGroupLabels } from '@/hooks/useGroupLabels';
import { useElementWidth } from '@/hooks/useElementWidth';
import { usePersistedWidth } from '@/hooks/usePersistedWidth';
import { LABEL_MAX_W, LABEL_MIN_W, LABEL_NARROW_W, LABEL_W } from '@/utils/timelineTrack';
import { TimelineHeader } from '@/components/common/timeline/TimelineHeader';
import { TimelineLabelResizer } from '@/components/common/timeline/TimelineLabelResizer';
import { useTimelineDrag } from '../../hooks/useTimelineDrag';
import { useIssueReorder } from '../../hooks/useIssueReorder';
import { buildTimeline, labelWidthKey, SCALE_DAY_W } from '../../utils/timeline';
import { IssueDragOverlay } from '../shared/IssueDragOverlay';
import { TimelineGroupRow } from './TimelineGroupRow';
import { TimelineSubgroupRow } from './TimelineSubgroupRow';
import { TimelineIssueBlock } from './TimelineIssueBlock';
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
  filters,
  settings,
  onOpenIssue,
  collapsedGroups,
  onToggleGroup,
  viewId,
  readOnly,
}: TimelineViewProps) {
  const t = useTranslations('workItems.timeline');
  const { can } = usePermissions(project);
  const groupLabels = useGroupLabels();
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
  const { width: titleWidth, setWidth: setTitleWidth } = usePersistedWidth(
    labelWidthKey(project.project.key, viewId ?? null),
    LABEL_W,
    LABEL_MIN_W,
    LABEL_MAX_W,
  );
  const maps = buildMaps(project);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { preview, beginDrag } = useTimelineDrag({ project, dayW: DAY_W, onOpenIssue });
  const reorder = useIssueReorder({ project, sort: settings.sort, readOnly: barsReadOnly });
  // Width of the scroll area, so the track can extend with trailing days until it
  // fills the viewport instead of leaving empty space on the right.
  const viewportW = useElementWidth(scrollRef);

  // Narrow the sticky label column on small screens so the day track is usable;
  // on wider ones it is the width the grip was dragged to.
  const narrow = viewportW < 640;
  const labelW = narrow ? LABEL_NARROW_W : titleWidth;
  const subgrouped = settings.group !== 'none' && settings.subgroup !== 'none';
  const { rows, days, months, trackWidth, todayLeft, todayInRange, dayLines, spanToRect } =
    buildTimeline({
      project,
      filters,
      group: settings.group,
      subgroup: settings.subgroup,
      sort: settings.sort,
      groupLabels,
      showEmptyGroups: settings.showEmptyGroups,
      collapsedGroups: activeCollapsedGroups,
      viewportW,
      labelW,
      dayW: DAY_W,
    });

  return (
    <DndContext
      sensors={reorder.sensors}
      collisionDetection={reorder.collisionDetection}
      onDragStart={reorder.onDragStart}
      onDragCancel={reorder.onDragCancel}
      onDragEnd={reorder.onDragEnd}
    >
      {/* Time runs left to right in every language, and the bars are positioned in
          pixels from the left edge, so the track keeps its direction even when the
          rest of the interface is mirrored. */}
      <div ref={scrollRef} dir="ltr" className="h-full overflow-auto">
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
            <div className="p-8 text-center text-sm text-muted-foreground">{t('empty')}</div>
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
                  disabled={subgrouped && !row.collapsed}
                  onDrop={(id) => reorder.moveIssue(id, row.assign, row.bucket, row.bucket.length)}
                  onToggle={() => toggleGroup(row.group.key)}
                />
              );
            }

            if (row.kind === 'subgroup') {
              return (
                <TimelineSubgroupRow
                  key={`s-${row.groupKey}`}
                  sub={row.sub}
                  groupKey={row.groupKey}
                  count={row.count}
                  collapsed={row.collapsed}
                  aggregateRect={
                    row.aggregateSpan
                      ? spanToRect(row.aggregateSpan.start, row.aggregateSpan.end)
                      : null
                  }
                  labelW={labelW}
                  trackWidth={trackWidth}
                  onDrop={(id) => reorder.moveIssue(id, row.assign, row.bucket, row.bucket.length)}
                  onToggle={() => toggleGroup(row.groupKey)}
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
              <TimelineIssueBlock
                key={issue.id}
                issueId={issue.id}
                disabled={!reorder.manualOrder}
                onDrop={(draggedId) =>
                  reorder.moveIssue(draggedId, row.assign, row.bucket, row.index)
                }
              >
                <TimelineIssueRow
                  project={project}
                  issue={issue}
                  maps={maps}
                  span={span}
                  rect={rect}
                  color={issueColor(issue, maps)}
                  active={active}
                  indented={subgrouped}
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
                  indented={subgrouped}
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
                  indented={subgrouped}
                  maps={maps}
                  labelW={labelW}
                  trackWidth={trackWidth}
                  dayLines={dayLines}
                  todayInRange={todayInRange}
                  todayLeft={todayLeft}
                  spanToRect={spanToRect}
                  onOpen={onOpenIssue}
                />
              </TimelineIssueBlock>
            );
          })}
        </div>
      </div>

      <IssueDragOverlay issue={reorder.activeIssue} />
    </DndContext>
  );
}
