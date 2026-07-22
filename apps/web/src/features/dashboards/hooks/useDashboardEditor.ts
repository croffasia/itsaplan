import { useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { Dashboard } from '@/lib/api';
import {
  DEFAULT_DASHBOARD_LAYOUT,
  createWidget,
  normalizeLayout,
  type DashboardLayout,
  type WidgetInstance,
  type WidgetType,
} from '@/utils/dashboardWidgets';
import {
  useCreateDashboard,
  useDeleteDashboard,
  useReorderDashboards,
  useUpdateDashboard,
} from '@/services/dashboards.service';

// Drives the dashboards section: which layout is on screen, its unsaved edits,
// and the create/rename/delete/reorder writes. The active dashboard comes from
// the route (activeDashboardId); selecting one is a navigation, not local state.
// When no dashboard is active (or the project has none) the built-in default
// layout is shown, and saving it creates the project's first dashboard.
export function useDashboardEditor(
  projectKey: string | null,
  dashboards: Dashboard[],
  activeDashboardId: number | null,
  onSelectDashboard: (id: number | null) => void,
) {
  const createM = useCreateDashboard(projectKey);
  const updateM = useUpdateDashboard(projectKey);
  const deleteM = useDeleteDashboard(projectKey);
  const reorderM = useReorderDashboards(projectKey);

  const active = dashboards.find((d) => d.id === activeDashboardId) ?? null;
  const isVirtual = active == null;
  const baseLayout: DashboardLayout = active
    ? normalizeLayout(active.layout)
    : DEFAULT_DASHBOARD_LAYOUT;

  // A draft is scoped to one dashboard (keyed by its id, or 'default' for the
  // virtual one). Navigating to another dashboard changes the key, so the draft
  // no longer matches and the base layout shows — unsaved edits are dropped on
  // navigation, which is the expected "switch tab, lose the scratch edit" behavior.
  const activeKey = String(activeDashboardId ?? 'default');
  const [draft, setDraft] = useState<{ key: string; layout: DashboardLayout } | null>(null);
  const layout = draft && draft.key === activeKey ? draft.layout : baseLayout;
  const dirty = draft != null && draft.key === activeKey;

  const edit = (next: DashboardLayout) => setDraft({ key: activeKey, layout: next });

  const addWidget = (type: WidgetType) => {
    // Drop the new widget below everything so it never overlaps existing ones;
    // react-grid-layout's compaction pulls it up to the first free slot.
    const bottom = layout.reduce((m, w) => Math.max(m, w.y + w.h), 0);
    edit([...layout, { ...createWidget(type), x: 0, y: bottom }]);
  };
  const removeWidget = (id: string) => edit(layout.filter((w) => w.id !== id));
  const updateWidget = (id: string, patch: Partial<Omit<WidgetInstance, 'id' | 'type'>>) =>
    edit(
      layout.map((w) =>
        w.id === id
          ? { ...w, ...patch, config: patch.config ? { ...w.config, ...patch.config } : w.config }
          : w,
      ),
    );
  // Applies react-grid-layout's positions/sizes back onto the widgets after a
  // drag or resize. `items` is RGL's layout array ({ i, x, y, w, h }).
  const applyGrid = (
    items: readonly { i: string; x: number; y: number; w: number; h: number }[],
  ) => {
    const byId = new Map(items.map((it) => [it.i, it]));
    edit(
      layout.map((w) => {
        const it = byId.get(w.id);
        return it ? { ...w, x: it.x, y: it.y, w: it.w, h: it.h } : w;
      }),
    );
  };

  const discard = () => setDraft(null);

  // Persists the working layout: updates the active dashboard, or creates the
  // first one (from the default) when the virtual dashboard is on screen.
  const save = async () => {
    if (isVirtual) {
      const created = await createM.mutateAsync({ input: { name: 'Overview', layout } });
      setDraft(null);
      onSelectDashboard(created.id);
    } else {
      await updateM.mutateAsync({ id: active.id, input: { layout } });
      setDraft(null);
    }
  };

  // --- Dashboard-level operations (the tab strip) --------------------------------

  const createDashboard = async (name: string) => {
    const created = await createM.mutateAsync({
      input: { name, layout: DEFAULT_DASHBOARD_LAYOUT },
    });
    onSelectDashboard(created.id);
  };

  const renameDashboard = (d: Dashboard, name: string) =>
    updateM.mutateAsync({ id: d.id, input: { name } });

  const deleteDashboard = async (d: Dashboard) => {
    await deleteM.mutateAsync(d.id);
    if (activeDashboardId === d.id) {
      const next = dashboards.find((x) => x.id !== d.id);
      onSelectDashboard(next ? next.id : null);
    }
  };

  const reorderDashboards = (draggedId: number, targetId: number) => {
    const ids = dashboards.map((d) => d.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1 || from === to) return;
    reorderM.mutate(arrayMove(ids, from, to));
  };

  return {
    active,
    isVirtual,
    layout,
    dirty,
    saving: createM.isPending || updateM.isPending,
    addWidget,
    removeWidget,
    updateWidget,
    applyGrid,
    discard,
    save,
    createDashboard,
    renameDashboard,
    deleteDashboard,
    reorderDashboards,
  };
}

export type DashboardEditor = ReturnType<typeof useDashboardEditor>;
