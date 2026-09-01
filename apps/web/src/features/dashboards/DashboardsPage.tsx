'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
// widgets. The active dashboard comes from the route; with none selected the
// built-in Overview stays active even when the project also has saved dashboards.
// Layout edits are local until saved (see useDashboardEditor).
export default function DashboardsPage() {
  const t = useTranslations('dashboards');
  const tCommon = useTranslations('common');
  const { project } = useShell();
  const { can } = usePermissions();
  const params = useParams<{ projectKey: string; dashboardId?: string }>();
  const router = useRouter();
  const projectKey = params.projectKey;

  const { data: dashboards, isLoading } = useDashboardsQuery(projectKey);
  const [editing, setEditing] = useState(false);

  const list = dashboards ?? [];
  const parsedRouteId = params.dashboardId ? Number(params.dashboardId) : null;
  const routeId =
    parsedRouteId != null && Number.isSafeInteger(parsedRouteId) && parsedRouteId > 0
      ? parsedRouteId
      : null;
  const activeDashboardId = routeId;
  const missingDashboard =
    !isLoading &&
    params.dashboardId != null &&
    (routeId == null || !list.some((dashboard) => dashboard.id === routeId));

  const selectDashboard = (id: number | null) => {
    setEditing(false);
    router.push(id != null ? dashboardPath(projectKey, id) : dashboardsPath(projectKey));
  };

  const editor = useDashboardEditor(projectKey, list, activeDashboardId, project, selectDashboard);

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

  // Layout editing (add/move/resize/remove widgets, save) is a dashboards edit.
  const canEditLayout = editor.isVirtual ? can('dashboards', 'create') : can('dashboards', 'edit');

  function saveLabel() {
    if (editor.saving) return tCommon('saving');
    return editor.isVirtual ? t('saveDashboard') : t('saveChanges');
  }

  function layoutActions() {
    if (!canEditLayout) return undefined;
    if (!editing) {
      return (
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          {t('editLayout')}
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
              {t('discard')}
            </Button>
            <Button size="sm" disabled={editor.saving} onClick={() => void editor.save()}>
              {saveLabel()}
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
            {tCommon('done')}
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
        onSelect={selectDashboard}
        onNewDashboard={(name, preset) => editor.createDashboard(name, preset)}
        onRename={(d, name) => void editor.renameDashboard(d, name)}
        onDelete={(d) => void editor.deleteDashboard(d)}
        onReorder={(dragged, target) => editor.reorderDashboards(dragged, target)}
        actions={layoutActions()}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <WidgetGrid projectKey={projectKey} project={project} editor={editor} editing={editing} />
        </div>
      </div>
    </div>
  );
}
