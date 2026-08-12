'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useInitiativeCountsQuery, useInitiativesQuery } from '@/services/initiatives.service';
import { INITIATIVE_SORTS, type InitiativeSort } from '@/lib/api';
import { useStripSortSensors } from '@/lib/dnd';
import { initiativesTabPath, type InitiativesTab } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList } from '@/components/ui/tabs';
import InitiativesList from './components/list/InitiativesList';
import InitiativesPagination from './components/list/InitiativesPagination';
import CreateInitiativeDialog from './components/list/CreateInitiativeDialog';
import InitiativeTabTrigger from './components/list/InitiativeTabTrigger';
import { useInitiativeTabOrder } from './hooks/useInitiativeTabOrder';
import { INITIATIVE_TABS, tabCount } from './utils/tabs';

const PAGE_SIZE = 25;

// A project's initiatives, one status tab at a time. The open tab is a route of its
// own and the page and sorting are query parameters, so the list reopens as it was
// after a reload and can be shared as a link. Each tab loads its own page from the
// server, sorted and paged there; the tab counts come from a separate aggregate so
// they stay correct regardless of the current page. The tab strip is sortable by
// drag, and its order is a preference of the browser (see useInitiativeTabOrder).
export default function InitiativesPage({ tab }: { tab: InitiativesTab }) {
  const t = useTranslations('initiatives');
  const { project } = useShell();
  const { can } = usePermissions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(false);
  const { order, reorder } = useInitiativeTabOrder();
  const sensors = useStripSortSensors();

  const projectKey = project?.project.key ?? null;
  const activeTab = INITIATIVE_TABS.find((item) => item.value === tab)!;
  const orderedTabs = order.map((value) => INITIATIVE_TABS.find((item) => item.value === value)!);

  const pageParam = Number(searchParams.get('page'));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  // A sort the server does not support is no sort at all, and a direction on its own
  // means nothing.
  const sort = INITIATIVE_SORTS.find((key) => key === searchParams.get('sort'));
  const sortDir = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const dir = sort ? sortDir : undefined;

  const query = useInitiativesQuery(projectKey, {
    statuses: activeTab.statuses,
    sort,
    dir,
    page,
    pageSize: PAGE_SIZE,
  });
  const counts = useInitiativeCountsQuery(projectKey).data;

  if (!project) return null;

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  const tabPath = initiativesTabPath(project.project.key, tab);

  const pushQuery = (params: URLSearchParams) => {
    const search = params.toString();
    router.push(search ? `${tabPath}?${search}` : tabPath);
  };

  // A tab is its own route and carries no query, so switching one drops the page and
  // the sorting of the tab left behind.
  const changeTab = (next: InitiativesTab) => {
    router.push(initiativesTabPath(project.project.key, next));
  };

  const changePage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    if (next > 1) params.set('page', String(next));
    else params.delete('page');
    pushQuery(params);
  };

  // Re-selecting the sorted column flips its direction; a new column sorts ascending.
  const changeSort = (key: InitiativeSort) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', key);
    params.set('dir', sort === key && sortDir === 'asc' ? 'desc' : 'asc');
    params.delete('page');
    pushQuery(params);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      reorder(active.id as InitiativesTab, over.id as InitiativesTab);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        {can('initiatives', 'create') && (
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            {t('newInitiative')}
          </Button>
        )}
      </div>

      <div className="min-w-0 px-4 pb-2">
        {/* The open tab comes from the route, and each trigger navigates on click
            (see InitiativeTabTrigger), so Radix drives no selection of its own:
            manual activation keeps focus from switching tabs mid-drag. */}
        <Tabs value={tab} activationMode="manual">
          <TabsList variant="line" className="overflow-x-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={order} strategy={horizontalListSortingStrategy}>
                {orderedTabs.map((item) => (
                  <InitiativeTabTrigger
                    key={item.value}
                    value={item.value}
                    label={t(`tabs.${item.value}`)}
                    count={tabCount(counts, item.value)}
                    onSelect={() => changeTab(item.value)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </TabsList>
        </Tabs>
      </div>

      <InitiativesList
        initiatives={items}
        project={project}
        isLoading={query.isLoading}
        canCreate={can('initiatives', 'create')}
        onCreate={() => setCreating(true)}
        statusTab={activeTab.value === 'all' ? undefined : activeTab.value}
        sort={sort}
        dir={dir}
        onSort={changeSort}
      />

      <InitiativesPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={changePage} />

      {creating && projectKey && (
        <CreateInitiativeDialog projectKey={projectKey} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}
