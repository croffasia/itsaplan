'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useShellRoute } from '@/hooks/useShellRoute';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { titlePath, useDocumentTitle } from '@/hooks/useDocumentTitle';
import { dashboardPath, dashboardsPath } from '@/utils/paths';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardsQuery } from '@/services/dashboards.service';
import type { WidgetType } from '@/utils/dashboardWidgets';
import { useDashboardEditor } from './hooks/useDashboardEditor';
import DashboardTabs from './components/DashboardTabs';
import DashboardLayoutActions from './components/DashboardLayoutActions';
import WidgetGrid from './components/WidgetGrid';
import AddWidgetPanel from './components/AddWidgetPanel';

// The dashboards section: a tab strip of named dashboards over a grid of analytics
// widgets. The active dashboard comes from the route; with none selected the
// built-in Overview stays active even when the project also has saved dashboards.
// Layout edits are local until saved (see useDashboardEditor). In edit mode the add
// panel opens over the grid, widgets are dragged from it onto the grid, and the ones
// added while it is open are marked as new.
export default function DashboardsPage() {
  const t = useTranslations('dashboards');
  const { project } = useShell();
  const { can } = usePermissions();
  const params = useParams<{ dashboardId?: string }>();
  const router = useRouter();
  const projectKey = useShellRoute().projectKey ?? '';

  const { data: dashboards, isLoading, isFetching, isSuccess } = useDashboardsQuery(projectKey);
  const [editing, setEditing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  // The ids of the widgets dropped from the add panel since it opened.
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [dragType, setDragType] = useState<WidgetType | null>(null);

  const list = dashboards ?? [];
  const parsedRouteId = params.dashboardId ? Number(params.dashboardId) : null;
  const routeId =
    parsedRouteId != null && Number.isSafeInteger(parsedRouteId) && parsedRouteId > 0
      ? parsedRouteId
      : null;
  const activeDashboardId = routeId;
  useDocumentTitle(
    titlePath(
      project?.project.name,
      isSuccess && list.find((dashboard) => dashboard.id === routeId)?.name,
    ),
  );
  const missingDashboard =
    isSuccess &&
    !isFetching &&
    params.dashboardId != null &&
    (routeId == null || !list.some((dashboard) => dashboard.id === routeId));

  const showPanel = (open: boolean) => {
    setPanelOpen(open);
    setAddedIds([]);
  };

  const stopEditing = () => {
    setEditing(false);
    showPanel(false);
  };

  const selectDashboard = (id: number | null) => {
    stopEditing();
    router.push(id != null ? dashboardPath(projectKey, id) : dashboardsPath(projectKey));
  };

  const editor = useDashboardEditor(projectKey, list, activeDashboardId, selectDashboard);
  // Undo, a discard or the widget's own menu can take an added widget away again.
  const addedWidgets = addedIds.flatMap((id) => editor.layout.filter((w) => w.id === id));

  useEffect(() => {
    if (missingDashboard) router.replace(dashboardsPath(projectKey));
  }, [missingDashboard, projectKey, router]);

  if (!project || isLoading || missingDashboard) {
    return (
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-8 w-full max-w-md" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!can('dashboards', 'read')) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
        {t('noAccess')}
      </div>
    );
  }

  // Saving Overview creates a dashboard; saved layouts require edit permission.
  const canEditLayout = editor.isVirtual ? can('dashboards', 'create') : can('dashboards', 'edit');

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DashboardTabs
        dashboards={list}
        activeDashboardId={activeDashboardId}
        isVirtual={editor.isVirtual}
        onSelect={selectDashboard}
        onNewDashboard={(name) => void editor.createDashboard(name)}
        onRename={(d, name) => void editor.renameDashboard(d, name)}
        onDelete={(d) => void editor.deleteDashboard(d)}
        onReorder={editor.reorderDashboards}
        actions={
          canEditLayout ? (
            <DashboardLayoutActions
              editor={editor}
              editing={editing}
              panelOpen={panelOpen}
              onEdit={() => setEditing(true)}
              onTogglePanel={() => showPanel(!panelOpen)}
              onDone={stopEditing}
            />
          ) : undefined
        }
      />

      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="flex w-full grow flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
            <WidgetGrid
              projectKey={projectKey}
              project={project}
              editor={editor}
              editing={editing}
              dropType={dragType}
              newIds={addedWidgets.map((w) => w.id)}
              onDropped={(id) => setAddedIds([...addedIds, id])}
            />
          </div>
        </div>
        {panelOpen && (
          <AddWidgetPanel
            addedTypes={addedWidgets.map((w) => w.type)}
            dragging={dragType != null}
            onDragStart={setDragType}
            onDragEnd={() => setDragType(null)}
            onUndo={() => {
              const last = addedWidgets.at(-1);
              if (last) editor.removeWidget(last.id);
            }}
            onClose={() => showPanel(false)}
          />
        )}
      </div>
    </div>
  );
}
