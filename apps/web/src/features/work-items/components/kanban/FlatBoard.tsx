import { DndContext } from '@dnd-kit/core';
import { toast } from 'sonner';
import { ChevronDown, Eye } from 'lucide-react';
import {
  buildGroups,
  buildMaps,
  groupIssues,
  sortIssues,
  type WorkItemsViewProps,
  type IssueGroup,
} from '@/utils/project';
import { useBoardDnd } from '../../hooks/useBoardDnd';
import { useSelection } from '../../context/useSelection';
import { boardCollision } from '../../utils/kanban';
import { sortedOrderMessage } from '../../utils/dnd';
import { Button } from '@/components/ui/button';
import { GroupDot } from '../shared/GroupDot';
import { CardOverlay } from './CardOverlay';
import { BoardColumn } from './BoardColumn';
import { CollapsedColumn } from './CollapsedColumn';

// Flat board: one vertically-virtualized column per group, laid out horizontally,
// with a trailing "Hidden" panel for manually-hidden columns.
export default function FlatBoard({
  project,
  settings,
  onSettingsChange,
  onOpenIssue,
  onAddIssue,
  readOnly,
}: WorkItemsViewProps) {
  const dnd = useBoardDnd(project.project.key, readOnly);
  const selection = useSelection();

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

  const groups = buildGroups(project, settings.group);
  const issuesByGroup = groupIssues(
    groups,
    sortIssues(project.issues, settings.sort, project),
    settings.group,
  );
  const maps = buildMaps(project);

  // Empty groups drop out entirely when "Show empty columns" is off; manual hide
  // moves the rest into the "Hidden" panel.
  const baseGroups = settings.showEmptyGroups
    ? groups
    : groups.filter((g) => (issuesByGroup.get(g.key)?.length ?? 0) > 0);
  const visibleGroups = baseGroups.filter((g) => !hiddenSet.has(g.key));
  const hiddenGroups = baseGroups.filter((g) => hiddenSet.has(g.key));
  const groupNoun = settings.group === 'status' ? 'columns' : 'groups';

  // Reordering inside a column only holds when the view is ordered manually: with
  // any other sort field the card would snap back to where the sort puts it. A drop
  // that would reorder is refused and explained; a drop into another column still
  // goes through, since it changes the grouping field rather than the order.
  const manualOrder = settings.sort.field === 'manual';

  function moveIssue(issueId: number, group: IssueGroup, position: number) {
    if (!group.assign) return;
    if (!manualOrder && (issuesByGroup.get(group.key) ?? []).some((i) => i.id === issueId)) {
      toast.info(sortedOrderMessage(settings.sort.field));
      return;
    }
    dnd.move(issueId, { ...group.assign, position });
  }

  function addIssueTo(group: IssueGroup) {
    onAddIssue({ columnId: project.columns[0]?.id ?? 0, ...group.assign });
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
        className="flex h-full gap-4 overflow-x-auto p-4"
        onClick={() => selection.isSelecting && selection.clear()}
      >
        {visibleGroups.map((group) =>
          collapsedSet.has(group.key) ? (
            <CollapsedColumn
              key={group.key}
              group={group}
              count={issuesByGroup.get(group.key)?.length ?? 0}
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
              Hidden {groupNoun}
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
                    <span className="text-muted-foreground">
                      {issuesByGroup.get(group.key)?.length ?? 0}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground"
                    onClick={() => setHidden(group.key, false)}
                    title="Show"
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
        issues={project.issues}
        maps={maps}
        properties={settings.properties}
      />
    </DndContext>
  );
}
