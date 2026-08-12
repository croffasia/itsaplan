'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { usePlannedCyclesQuery } from '@/services/cycles.service';
import { cyclesViewPath, type CyclesView } from '@/utils/paths';
import { rememberCyclesView } from './utils/cyclesView';
import { useCompletedCycles } from './hooks/useCompletedCycles';
import CyclesList from './components/list/CyclesList';
import CyclesViewTabs from './components/list/CyclesViewTabs';
import CycleFormDialog from './components/CycleFormDialog';

// A project's cycles, grouped by the status their dates put them in, as a table or
// on a timeline. Each layout is a route of its own, and the one picked becomes the
// project's remembered layout. What is still planned loads whole — it stays a
// handful of cycles however old the project is; the finished ones only accumulate,
// so they are a paged archive of their own.
export default function CyclesPage({ view }: { view: CyclesView }) {
  const t = useTranslations('cycles');
  const { project } = useShell();
  const { can } = usePermissions();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const projectKey = project?.project.key ?? null;
  const query = usePlannedCyclesQuery(projectKey);
  const completed = useCompletedCycles(projectKey);

  if (!project || !projectKey) return null;

  const cycles = query.data ?? [];

  const changeView = (next: CyclesView) => {
    rememberCyclesView(projectKey, next);
    router.push(cyclesViewPath(projectKey, next));
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        {can('cycles', 'create') && (
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            {t('newCycle')}
          </Button>
        )}
      </div>

      <div className="min-w-0 px-4 pb-2">
        <CyclesViewTabs view={view} onSelect={changeView} />
      </div>

      <CyclesList
        cycles={cycles}
        completed={completed}
        projectKey={projectKey}
        view={view}
        isLoading={query.isLoading || completed.isLoading}
        canCreate={can('cycles', 'create')}
        onCreate={() => setCreating(true)}
      />

      {creating && <CycleFormDialog projectKey={projectKey} onClose={() => setCreating(false)} />}
    </div>
  );
}
