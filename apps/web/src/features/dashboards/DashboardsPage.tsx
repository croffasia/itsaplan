'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { dashboardPath, dashboardsPath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardsQuery } from '@/services/dashboards.service';
import { useDashboardEditor } from './hooks/useDashboardEditor';
import DashboardTabs from './components/DashboardTabs';
import WidgetGrid from './components/WidgetGrid';
import AddWidgetDialog from './components/AddWidgetDialog';

// The dashboards section: a tab strip of named dashboards over a grid of analytics
// widgets. The active dashboard comes from the route; with none selected the first
// saved dashboard shows, or a built-in default when the project has none. Layout
// edits are local until saved (see useDashboardEditor).
export default function DashboardsPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const params = useParams<{ projectKey: string; dashboardId?: string }>();
  const router = useRouter();
  const projectKey = params.projectKey;

  const { data: dashboards, isLoading } = useDashboardsQuery(projectKey);
  const [editing, setEditing] = useState(false);

  const list = dashboards ?? [];
  const routeId = params.dashboardId ? Number(params.dashboardId) : null;
  // With no id in the URL, fall back to the first saved dashboard.
  const activeDashboardId = routeId ?? list[0]?.id ?? null;

  const editor = useDashboardEditor(projectKey, list, activeDashboardId, (id) =>
    router.push(id != null ? dashboardPath(projectKey, id) : dashboardsPath(projectKey)),
  );

  if (!project || isLoading) {
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
        You do not have access to dashboards.
      </div>
    );
  }

  // Layout editing (add/move/resize/remove widgets, save) is a dashboards edit.
  const canEditLayout = can('dashboards', 'edit');

  function saveLabel() {
    if (editor.saving) return 'Saving…';
    return editor.isVirtual ? 'Save dashboard' : 'Save changes';
  }

  function layoutActions() {
    if (!canEditLayout) return undefined;
    if (!editing) {
      return (
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Edit layout
        </Button>
      );
    }
    return (
      <>
        <AddWidgetDialog onAdd={(type) => editor.addWidget(type)} />
        {editor.dirty ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={editor.saving}
              onClick={() => editor.discard()}
            >
              Discard
            </Button>
            <Button size="sm" disabled={editor.saving} onClick={() => void editor.save()}>
              {saveLabel()}
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
            Done
          </Button>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DashboardTabs
        dashboards={list}
        activeDashboardId={activeDashboardId}
        isVirtual={editor.isVirtual}
        onSelect={(id) => router.push(dashboardPath(projectKey, id))}
        onNewDashboard={(name) => void editor.createDashboard(name)}
        onRename={(d, name) => void editor.renameDashboard(d, name)}
        onDelete={(d) => void editor.deleteDashboard(d)}
        onReorder={(dragged, target) => editor.reorderDashboards(dragged, target)}
        actions={layoutActions()}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-6 py-8 lg:px-10">
          <WidgetGrid projectKey={projectKey} project={project} editor={editor} editing={editing} />
        </div>
      </div>
    </div>
  );
}
