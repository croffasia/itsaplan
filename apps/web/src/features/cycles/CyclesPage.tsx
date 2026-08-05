'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { useCyclesQuery } from '@/services/cycles.service';
import { useCyclesView } from './hooks/useCyclesView';
import CyclesList from './components/list/CyclesList';
import CyclesViewTabs from './components/list/CyclesViewTabs';
import CycleFormDialog from './components/CycleFormDialog';

// A project's cycles, grouped by the status their dates put them in, as a table or
// on a timeline. The list is short by nature (a cycle is weeks long), so it loads in
// one request with no paging.
export default function CyclesPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const [creating, setCreating] = useState(false);

  const projectKey = project?.project.key ?? null;
  const query = useCyclesQuery(projectKey);
  const { view, setView } = useCyclesView(projectKey ?? '');

  if (!project || !projectKey) return null;

  const cycles = query.data ?? [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h1 className="text-lg font-semibold">Cycles</h1>
        <div className="flex items-center gap-2">
          {cycles.length > 0 && <CyclesViewTabs view={view} onChange={setView} />}
          {can('cycles', 'create') && (
            <Button size="sm" className="h-8 gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="size-3.5" />
              New cycle
            </Button>
          )}
        </div>
      </div>

      <CyclesList
        cycles={cycles}
        projectKey={projectKey}
        view={view}
        isLoading={query.isLoading}
        canCreate={can('cycles', 'create')}
        onCreate={() => setCreating(true)}
      />

      {creating && <CycleFormDialog projectKey={projectKey} onClose={() => setCreating(false)} />}
    </div>
  );
}
