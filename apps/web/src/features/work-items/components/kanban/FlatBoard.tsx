import { DndContext } from '@dnd-kit/core';
import { toast } from 'sonner';
import { ChevronDown, Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  buildGroups,
  buildMaps,
  groupIssues,
  positionsAt,
  sortIssues,
  type WorkItemsViewProps,
  type IssueGroup,
} from '@/utils/project';
import { isActiveFilterSet } from '@/utils/filters';
import { useBoardDnd } from '../../hooks/useBoardDnd';
import { useSortedOrderMessage } from '../../hooks/useSortedOrderMessage';
import { useWipLimitMessage } from '../../hooks/useWipLimitMessage';
import { countEntering, wipAllows, wipStateFor } from '../../utils/wipLimit';
import { useGroupLabels } from '@/hooks/useGroupLabels';
import { useSelection } from '../../context/useSelection';
import { boardCollision, issuesToMove } from '../../utils/kanban';
import { Button } from '@/components/ui/button';
import { GroupDot } from '../shared/GroupDot';
import { CardOverlay } from './CardOverlay';
import { BoardColumn } from './BoardColumn';
import { CollapsedColumn } from './CollapsedColumn';
import { WipCount } from './WipCount';

// Flat board: one vertically-virtualized column per group, laid out horizontally,
// with a trailing "Hidden" panel for manually-hidden columns.
export default function FlatBoard({
  project,
  filters,
  columnCounts,
  settings,
  onSettingsChange,
  onOpenIssue,
  onAddIssue,
  readOnly,
}: WorkItemsViewProps) {
  const t = useTranslations('workItems');
  const groupLabels = useGroupLabels();
  const sortedOrderMessage = useSortedOrderMessage();
  const wipLimitMessage = useWipLimitMessage();
  const dnd = useBoardDnd(project.project.key, readOnly);
  const selection = useSelection();
  const filtered = isActiveFilterSet(filters);

  // Hidden columns live in the view's display (settings.hiddenGroups); toggling
  // one writes through onSettingsChange (a display edit on a saved view, saved on
  // Save; immediate localStorage on the All tab).
  const hiddenSet = new Set(settings.hiddenGroups);
  const setHidden = (key: string, hide: boolean) =>
    onSettingsChange({
      ...settings,
      hiddenGroups: hide
        ? [...settings.hiddenGroups, key]
        : settings.hiddenGroups.filter((k) => k !== key),
    });

  // Collapsed columns stay in place as a narrow strip; the state lives in the
  // view's display (settings.collapsedGroups) and persists the same way as
  // hiddenGroups.
  const collapsedSet = new Set(settings.collapsedGroups);
  const setCollapsed = (key: string, collapse: boolean) =>
    onSettingsChange({
      ...settings,
      collapsedGroups: collapse
        ? [...settings.collapsedGroups, key]
        : settings.collapsedGroups.filter((k) => k !== key),
    });

  const groups = buildGroups(project, settings.group, groupLabels, filters);
  const sorted = sortIssues(project.issues, settings.sort, project);
  const issuesByGroup = groupIssues(groups, sorted, settings.group);
  const maps = buildMaps(project);

  // Empty groups drop out entirely when "Show empty columns" is off; manual hide
  // moves the rest into the "Hidden" panel.
  const baseGroups = settings.showEmptyGroups
    ? groups
    : groups.filter((g) => (issuesByGroup.get(g.key)?.length ?? 0) > 0);
  const visibleGroups = baseGroups.filter((g) => !hiddenSet.has(g.key));
  const hiddenGroups = baseGroups.filter((g) => hiddenSet.has(g.key));

  // Reordering inside a column only holds when the view is ordered manually: with
  // any other sort field the card would snap back to where the sort puts it. Cards
  // already in the target column are then skipped, and a drop left with nothing to
  // move is refused and explained; a card from another column still goes through,
  // since that changes the grouping field rather than the order.
  const manualOrder = settings.sort.field === 'manual';

  const wipOf = (group: IssueGroup) => wipStateFor(group, project.columns, columnCounts);

  function moveIssue(issueIds: number[], group: IssueGroup, index: number) {
    const assign = group.assign;
    if (!assign) return;
    const target = issuesByGroup.get(group.key) ?? [];
    const ids = issuesToMove(issueIds, sorted, target, manualOrder);
    if (ids.length === 0) {
      toast.info(sortedOrderMessage(settings.sort.field));
      return;
    }
    // Refused here rather than left to the server: the move is optimistic, so a
    // card would otherwise land in the column and snap back out of it.
    const wip = wipOf(group);
    if (wip && !wipAllows(wip, countEntering(ids, sorted, group))) {
      toast.info(wipLimitMessage(group.name, wip.limit));
      return;
    }
    const positions = positionsAt(target, index, ids.length);
    ids.forEach((id, n) => dnd.move(id, { ...assign, position: positions[n] }));
  }

  function addIssueTo(group: IssueGroup) {
    onAddIssue({ ...group.assign });
  }

  return (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={boardCollision}
      onDragStart={dnd.onDragStart}
      onDragCancel={dnd.onDragCancel}
      onDragEnd={dnd.onDragEnd}
    >
      {/* A click that reaches the board background (not a card or control, which
          stop propagation) clears the selection, like Escape. */}
      <div
        className="flex h-full gap-3 overflow-x-auto p-4"
        onClick={() => selection.isSelecting && selection.clear()}
      >
        {visibleGroups.map((group) =>
          collapsedSet.has(group.key) ? (
            <CollapsedColumn
              key={group.key}
              group={group}
              count={issuesByGroup.get(group.key)?.length ?? 0}
              wip={wipOf(group)}
              onExpand={() => setCollapsed(group.key, false)}
              onAddIssue={() => addIssueTo(group)}
              readOnly={readOnly}
            />
          ) : (
            <BoardColumn
              key={group.key}
              project={project}
              group={group}
              issues={issuesByGroup.get(group.key) ?? []}
              maps={maps}
              properties={settings.properties}
              manualOrder={manualOrder}
              wip={wipOf(group)}
              filtered={filtered}
              boardIssues={sorted}
              onMoveIssue={moveIssue}
              onOpenIssue={onOpenIssue}
              onAddIssue={() => addIssueTo(group)}
              onHide={() => setHidden(group.key, true)}
              onCollapse={() => setCollapsed(group.key, true)}
              readOnly={readOnly}
            />
          ),
        )}

        {hiddenGroups.length > 0 && (
          <div className="ml-auto w-64 shrink-0 self-start rounded-md border p-2">
            <div className="flex w-full items-center gap-1.5 px-1 py-1 text-sm font-medium text-muted-foreground">
              <ChevronDown className="size-4" />
              {settings.group === 'status' ? t('hiddenColumns') : t('hiddenGroups')}
            </div>
            <div className="mt-1 flex flex-col gap-1">
              {hiddenGroups.map((group) => (
                <div
                  key={group.key}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent/40"
                >
                  <div className="flex items-center gap-2 text-foreground">
                    <GroupDot group={group} />
                    {group.name}
                    <WipCount
                      filteredCount={issuesByGroup.get(group.key)?.length ?? 0}
                      wip={wipOf(group)}
                      filtered={filtered}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground"
                    onClick={() => setHidden(group.key, false)}
                    title={t('show')}
                  >
                    <Eye />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <CardOverlay
        activeId={dnd.activeId}
        count={dnd.activeCount}
        issues={project.issues}
        maps={maps}
        properties={settings.properties}
      />
    </DndContext>
  );
}
