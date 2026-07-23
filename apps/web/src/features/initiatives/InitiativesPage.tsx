'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useInitiativeCountsQuery, useInitiativesQuery } from '@/services/initiatives.service';
import type { InitiativeCounts, InitiativeSort, InitiativeStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InitiativesList from './components/list/InitiativesList';
import InitiativesPagination from './components/list/InitiativesPagination';
import CreateInitiativeDialog from './components/list/CreateInitiativeDialog';
import InitiativeTabCount from './components/list/InitiativeTabCount';

const PAGE_SIZE = 25;

type Tab = 'all' | 'proposed' | 'planned' | 'active' | 'completed';

// One tab per lifecycle status, except the terminal statuses share a "Completed"
// tab. `statuses: undefined` means the tab takes every status.
const TABS: { value: Tab; label: string; statuses: InitiativeStatus[] | undefined }[] = [
  { value: 'all', label: 'All initiatives', statuses: undefined },
  { value: 'proposed', label: 'Proposed', statuses: ['proposed'] },
  { value: 'planned', label: 'Planned', statuses: ['planned'] },
  { value: 'active', label: 'Active', statuses: ['active'] },
  { value: 'completed', label: 'Completed', statuses: ['completed', 'canceled'] },
];

// The "Completed" tab groups the two terminal statuses, so its count sums them.
function tabCount(counts: InitiativeCounts | undefined, tab: Tab): number | undefined {
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

// A project's initiatives, one status tab at a time. Each tab loads its own page
// from the server, sorted and paged there; the tab counts come from a separate
// aggregate so they stay correct regardless of the current page.
export default function InitiativesPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: InitiativeSort; dir: 'asc' | 'desc' } | null>(null);
  const [creating, setCreating] = useState(false);

  const projectKey = project?.project.key ?? null;
  const statuses = TABS.find((t) => t.value === tab)!.statuses;

  const query = useInitiativesQuery(projectKey, {
    statuses,
    sort: sort?.key,
    dir: sort?.dir,
    page,
    pageSize: PAGE_SIZE,
  });
  const counts = useInitiativeCountsQuery(projectKey).data;

  if (!project) return null;

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  const changeTab = (next: Tab) => {
    setTab(next);
    setPage(1);
  };

  // Re-selecting the sorted column flips its direction; a new column sorts ascending.
  const changeSort = (key: InitiativeSort) => {
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
    setPage(1);
  };

  return (
    <div className="flex-1 overflow-y-auto">
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
        <Tabs value={tab} onValueChange={(v) => changeTab(v as Tab)}>
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
        sort={sort?.key}
        dir={sort?.dir}
        onSort={changeSort}
      />

      <InitiativesPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

      {creating && projectKey && (
        <CreateInitiativeDialog projectKey={projectKey} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}
