import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { LayoutDashboard, Plus } from 'lucide-react';
import type { Dashboard } from '@/lib/api';
import { useStripSortSensors } from '@/lib/dnd';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardTab from './DashboardTab';
import DashboardNameDialog from './DashboardNameDialog';

// The row of dashboard tabs. Each named dashboard is a sortable tab; the active
// one exposes Rename/Delete. A "New dashboard" button and a name dialog handle
// create/rename. When the project has no dashboards, a single non-clickable
// "Overview" chip stands in for the built-in default.
export default function DashboardTabs({
  dashboards,
  activeDashboardId,
  isVirtual,
  actions,
  onSelect,
  onNewDashboard,
  onRename,
  onDelete,
  onReorder,
}: {
  dashboards: Dashboard[];
  activeDashboardId: number | null;
  isVirtual: boolean;
  actions?: React.ReactNode;
  onSelect: (id: number) => void;
  onNewDashboard: (name: string) => void;
  onRename: (d: Dashboard, name: string) => void;
  onDelete: (d: Dashboard) => void;
  onReorder: (draggedId: number, targetId: number) => void;
}) {
  const { can } = usePermissions();
  const canCreate = can('dashboards', 'create');
  const canEdit = can('dashboards', 'edit');
  const canDelete = can('dashboards', 'delete');
  const sensors = useStripSortSensors();
  const [activeId, setActiveId] = useState<number | null>(null);
  const dragged = activeId != null ? dashboards.find((d) => d.id === activeId) : null;
  // Name dialog state: 'new' to create, a dashboard to rename, or null (closed).
  const [dialog, setDialog] = useState<'new' | Dashboard | null>(null);
  const renaming = dialog && dialog !== 'new' ? dialog : null;

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (over && active.id !== over.id) onReorder(Number(active.id), Number(over.id));
  }

  return (
    <div className="flex items-center gap-1 border-b px-2 py-1.5 sm:px-3">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {dashboards.length === 0 ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-sm font-medium text-foreground">
            <LayoutDashboard className="size-3.5" />
            Overview
          </span>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e: DragStartEvent) => setActiveId(Number(e.active.id))}
            onDragCancel={() => setActiveId(null)}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={dashboards.map((d) => d.id)}
              strategy={horizontalListSortingStrategy}
            >
              {dashboards.map((d) => (
                <DashboardTab
                  key={d.id}
                  dashboard={d}
                  active={!isVirtual && activeDashboardId === d.id}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onSelect={() => onSelect(d.id)}
                  onRename={() => setDialog(d)}
                  onDelete={() => onDelete(d)}
                />
              ))}
            </SortableContext>
            <DragOverlay>
              {dragged ? (
                <span className="flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-sm font-medium text-foreground shadow-md">
                  <LayoutDashboard className="size-3.5" />
                  {dragged.name}
                </span>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {canCreate && (
          <button
            type="button"
            onClick={() => setDialog('new')}
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-3.5" />
            New dashboard
          </button>
        )}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2 pl-2">{actions}</div>}

      <DashboardNameDialog
        key={renaming?.id ?? (dialog === 'new' ? 'new' : 'closed')}
        open={dialog != null}
        title={renaming ? 'Rename dashboard' : 'New dashboard'}
        initial={renaming?.name ?? ''}
        onClose={() => setDialog(null)}
        onSubmit={(name) => {
          if (renaming) onRename(renaming, name);
          else if (dialog === 'new') onNewDashboard(name);
          setDialog(null);
        }}
      />
    </div>
  );
}
