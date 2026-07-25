'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useInitiativeCountsQuery, useInitiativesQuery } from '@/services/initiatives.service';
import {
  INITIATIVE_SORTS,
  type InitiativeCounts,
  type InitiativeSort,
  type InitiativeStatus,
} from '@/lib/api';
import { initiativesTabPath, type InitiativesTab } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InitiativesList from './components/list/InitiativesList';
import InitiativesPagination from './components/list/InitiativesPagination';
import CreateInitiativeDialog from './components/list/CreateInitiativeDialog';
import InitiativeTabCount from './components/list/InitiativeTabCount';

const PAGE_SIZE = 25;

// One tab per lifecycle status, except the terminal statuses share a "Completed"
// tab. `statuses: undefined` means the tab takes every status.
const TABS: { value: InitiativesTab; label: string; statuses: InitiativeStatus[] | undefined }[] = [
  { value: 'all', label: 'All initiatives', statuses: undefined },
  { value: 'proposed', label: 'Proposed', statuses: ['proposed'] },
  { value: 'planned', label: 'Planned', statuses: ['planned'] },
  { value: 'active', label: 'Active', statuses: ['active'] },
  { value: 'completed', label: 'Completed', statuses: ['completed', 'canceled'] },
];

// The "Completed" tab groups the two terminal statuses, so its count sums them.
function tabCount(counts: InitiativeCounts | undefined, tab: InitiativesTab): number | undefined {
  if (!counts) return undefined;
  switch (tab) {
    case 'all':
      return counts.total;
    case 'proposed':
      return counts.proposed;
    case 'planned':
      return counts.planned;
    case 'active':
      return counts.active;
    case 'completed':
      return counts.completed + counts.canceled;
  }
}

// A project's initiatives, one status tab at a time. The open tab is a route of its
// own and the page and sorting are query parameters, so the list reopens as it was
// after a reload and can be shared as a link. Each tab loads its own page from the
// server, sorted and paged there; the tab counts come from a separate aggregate so
// they stay correct regardless of the current page.
export default function InitiativesPage({ tab }: { tab: InitiativesTab }) {
  const { project } = useShell();
  const { can } = usePermissions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(false);

  const projectKey = project?.project.key ?? null;
  const activeTab = TABS.find((t) => t.value === tab)!;

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

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-semibold">Initiatives</h1>
        {can('initiatives', 'create') && (
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            New initiative
          </Button>
        )}
      </div>

      <div className="px-4 pb-2">
        <Tabs value={tab} onValueChange={(v) => changeTab(v as InitiativesTab)}>
          <TabsList variant="line">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
                <InitiativeTabCount value={tabCount(counts, t.value)} />
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <InitiativesList
        initiatives={items}
        project={project}
        isLoading={query.isLoading}
        canCreate={can('initiatives', 'create')}
        onCreate={() => setCreating(true)}
        statusLabel={activeTab.statuses ? activeTab.label : undefined}
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
