import { useState, type ReactNode } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { Filter, Plus } from 'lucide-react';
import type { View } from '@/lib/api';
import { useStripSortSensors } from '@/lib/dnd';
import { usePermissions } from '@/hooks/usePermissions';
import AllViewTab, { ALL_DROP_ID } from '@/components/layout/AllViewTab';
import MobileViewSwitcher from '@/components/layout/MobileViewSwitcher';
import SavedViewTab from '@/components/layout/SavedViewTab';
import ViewTabChrome from '@/components/layout/ViewTabChrome';
import ViewTabLabel from '@/components/layout/ViewTabLabel';

// The row of saved-view tabs above a project, plus a New view button and, on the
// right, the filter and display toggles. The leading "All" tab is implicit and
// has no filters; it cannot be deleted. The saved tabs are a horizontal sortable
// list — dragging one reorders it and persists via onReorder. The filter toggle
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
  onReorder,
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
  onReorder: (draggedId: number, targetId: number) => void;
  onToggleFilter: () => void;
  displayControl: ReactNode;
}) {
  const { can } = usePermissions();
  const canCreateView = can('views', 'create');
  const canEditView = can('views', 'edit');
  const canDeleteView = can('views', 'delete');
  const sensors = useStripSortSensors();
  // The view being dragged, used to render the DragOverlay preview.
  const [activeId, setActiveId] = useState<number | null>(null);
  const activeView = activeId != null ? (views.find((v) => v.id === activeId) ?? null) : null;

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const draggedId = Number(active.id);
    if (over.id === ALL_DROP_ID) {
      // Move to the front (next to the fixed All tab).
      if (views[0] && views[0].id !== draggedId) onReorder(draggedId, views[0].id);
      return;
    }
    if (over.id !== active.id) onReorder(draggedId, Number(over.id));
  }

  return (
    <div className="flex items-center gap-1 border-b px-2 py-1.5 sm:px-3">
      {/* Mobile: views collapse into a dropdown (no drag reorder there). */}
      <div className="flex min-w-0 flex-1 items-center sm:hidden">
        <MobileViewSwitcher
          views={views}
          activeViewId={activeViewId}
          canCreate={canCreateView}
          onSelect={onSelect}
          onNewView={onNewView}
        />
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

          <SortableContext items={views.map((v) => v.id)} strategy={horizontalListSortingStrategy}>
            {views.map((view) => (
              <SavedViewTab
                key={view.id}
                view={view}
                projectKey={projectKey}
                active={activeViewId === view.id}
                canEdit={canEditView}
                canDelete={canDeleteView}
                onSelect={() => onSelect(view.id)}
                onEdit={() => onEdit(view)}
                onDelete={() => onDelete(view)}
              />
            ))}
          </SortableContext>

          <DragOverlay>
            {activeView ? (
              <ViewTabChrome active className="cursor-grabbing shadow-md">
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
            title="Create a view from the current filters and display"
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-3.5" />
            New view
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pl-2">
        <button
          type="button"
          onClick={onToggleFilter}
          title="Filter"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Filter className="size-4" />
        </button>
        {displayControl}
      </div>
    </div>
  );
}
