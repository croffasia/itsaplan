'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useInitiativesQuery } from '@/services/initiatives.service';
import type { Initiative, InitiativeStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InitiativesList from './components/list/InitiativesList';
import CreateInitiativeDialog from './components/list/CreateInitiativeDialog';
import InitiativeTabCount from './components/list/InitiativeTabCount';

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

function filterByTab(initiatives: Initiative[], tab: Tab): Initiative[] {
  const { statuses } = TABS.find((t) => t.value === tab)!;
  return statuses ? initiatives.filter((i) => statuses.includes(i.status)) : initiatives;
}

// The list of a project's initiatives, filtered by a status tab. Rows link to the
// detail page. All initiatives are fetched once and filtered client-side so each
// tab can show its count.
export default function InitiativesPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const [tab, setTab] = useState<Tab>('all');
  const [creating, setCreating] = useState(false);

  const projectKey = project?.project.key ?? null;
  const query = useInitiativesQuery(projectKey);

  const all = query.data ?? [];

  if (!project) return null;

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
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList variant="line">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
                <InitiativeTabCount value={filterByTab(all, t.value).length} />
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <InitiativesList
        initiatives={filterByTab(all, tab)}
        project={project}
        isLoading={query.isLoading}
        canCreate={can('initiatives', 'create')}
        onCreate={() => setCreating(true)}
      />

      {creating && projectKey && (
        <CreateInitiativeDialog projectKey={projectKey} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}
