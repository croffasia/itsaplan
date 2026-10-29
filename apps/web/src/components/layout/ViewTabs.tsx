import { useState, type ReactNode } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { FilterIcon } from '@animateicons/react/lucide/filter-icon';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { View } from '@/lib/api/endpoints/views';
import { useDndSensors, useDroppedOrder } from '@/lib/dnd';
import { usePermissions } from '@/hooks/usePermissions';
import { movedInRow } from '@/services/views.service';
import AllViewTab, { ALL_DROP_ID } from '@/components/layout/AllViewTab';
import MobileViewSwitcher from '@/components/layout/MobileViewSwitcher';
import SavedViewTab from '@/components/layout/SavedViewTab';
import TabRowMenu from '@/components/layout/TabRowMenu';
import ToolbarIconButton from '@/components/layout/ToolbarIconButton';
import ViewTabChrome from '@/components/layout/ViewTabChrome';
import ViewTabLabel from '@/components/layout/ViewTabLabel';

// The row of saved-view tabs above a project, plus a New view button and, on the
// right, the filter and display toggles. The leading "All" tab is implicit and
// has no filters; it cannot be deleted. The saved tabs are the caller's own tab row, a
// horizontal sortable list — dragging one rearranges it and persists via onReorder, and
// the views the caller hid are listed in the menu at its end. The filter toggle
// shows the filter row, which filters the current screen only; onEdit opens the
// edit bar for a view (see WorkItemsPage).
export default function ViewTabs({
  views,
  projectKey,
  activeViewId,
  onSelect,
  onNewView,
  onEdit,
  onDelete,
  onDuplicate,
  onReorder,
  onHide,
  onShow,
  onResetRow,
  onPinProjectOrder,
  onToggleFilter,
  displayControl,
}: {
  views: View[];
  projectKey: string;
  activeViewId: number | null;
  onSelect: (id: number | null) => void;
  onNewView: () => void;
  onEdit: (view: View) => void;
  onDelete: (view: View) => void;
  onDuplicate: (view: View) => void;
  onReorder: (draggedId: number, targetId: number | null) => void;
  onHide: (view: View) => void;
  onShow: (view: View) => void;
  onResetRow: () => void;
  onPinProjectOrder: () => void;
  onToggleFilter: () => void;
  displayControl: ReactNode;
}) {
  const t = useTranslations('views');
  const { can, isMember } = usePermissions();
  // A member who reads the project's views may save a private one.
  const canCreateView = can('views', 'create') || (isMember && can('views', 'read'));
  const canEditView = can('views', 'edit');
  const canDeleteView = can('views', 'delete');
  const canPublishView = can('views', 'create');
  const sensors = useDndSensors();
  // The view being dragged, used to render the DragOverlay preview.
  const [activeId, setActiveId] = useState<number | null>(null);
  const { items: shown, drop } = useDroppedOrder(views);
  const activeView = activeId != null ? (views.find((v) => v.id === activeId) ?? null) : null;
  const row = shown.filter((v) => !v.hidden);
  const hidden = views.filter((v) => v.hidden);
  // The tab row is kept by anyone who reads the views, members or not.
  const tabRowMenu = can('views', 'read') && (
    <TabRowMenu
      hidden={hidden}
      canPinProjectOrder={canEditView && views.some((v) => !v.isPrivate)}
      onShow={onShow}
      onReset={onResetRow}
      onPinProjectOrder={onPinProjectOrder}
    />
  );

  // Shows at once the tab row the server will answer with once the drop is stored.
  function reorder(draggedId: number, targetId: number | null) {
    const moved = movedInRow(row, draggedId, targetId);
    if (!moved) return;
    drop([...moved, ...hidden].map((v) => v.id));
    onReorder(draggedId, targetId);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const draggedId = Number(active.id);
    if (over.id === ALL_DROP_ID) {
      // The fixed All tab stands for the front of the caller's row.
      reorder(draggedId, null);
      return;
    }
    if (over.id !== active.id) reorder(draggedId, Number(over.id));
  }

  return (
    <div className="flex items-center gap-1 border-b px-2 py-1.5 sm:px-3">
      {/* Mobile: views collapse into a dropdown (no drag reorder there). */}
      <div className="flex min-w-0 flex-1 items-center sm:hidden">
        <MobileViewSwitcher
          views={row}
          activeViewId={activeViewId}
          canCreate={canCreateView}
          onSelect={onSelect}
          onNewView={onNewView}
        />
        {/* A phone does not drag, but it shows the hidden views and resets the row. */}
        {tabRowMenu}
      </div>

      {/* Desktop: the scrollable, reorderable tab strip. */}
      <div className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:flex">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e: DragStartEvent) => setActiveId(Number(e.active.id))}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={handleDragEnd}
        >
          <AllViewTab
            active={activeViewId === null}
            dragging={activeId != null}
            onClick={() => onSelect(null)}
          />

          <SortableContext items={row.map((v) => v.id)} strategy={horizontalListSortingStrategy}>
            {row.map((view) => (
              <SavedViewTab
                key={view.id}
                view={view}
                projectKey={projectKey}
                active={activeViewId === view.id}
                canEdit={view.isPrivate || canEditView}
                canDelete={view.isPrivate || canDeleteView}
                canPublish={view.isPrivate && canPublishView}
                onSelect={() => onSelect(view.id)}
                onEdit={() => onEdit(view)}
                onDelete={() => onDelete(view)}
                canDuplicate={canCreateView}
                onDuplicate={() => onDuplicate(view)}
                onHide={() => onHide(view)}
              />
            ))}
          </SortableContext>

          <DragOverlay>
            {activeView ? (
              <ViewTabChrome
                active
                own={activeView.isPrivate}
                className="cursor-grabbing shadow-md"
              >
                <span className="flex items-center gap-1.5 py-1 pr-2 pl-2">
                  <ViewTabLabel view={activeView} />
                </span>
              </ViewTabChrome>
            ) : null}
          </DragOverlay>
        </DndContext>

        {canCreateView && (
          <button
            type="button"
            onClick={onNewView}
            title={t('newViewHint')}
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-3.5" />
            {t('newView')}
          </button>
        )}
        {tabRowMenu}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pl-2">
        <ToolbarIconButton icon={FilterIcon} title={t('filter')} onClick={onToggleFilter} />
        {displayControl}
      </div>
    </div>
  );
}
