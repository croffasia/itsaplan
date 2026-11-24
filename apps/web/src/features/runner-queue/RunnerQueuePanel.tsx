'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAccountPreferences, useUpdateAccountPreferences } from '@/services/preferences.service';
import ListColumn from '@/components/common/page/ListColumn';
import RunnerQueueList from './components/RunnerQueueList';
import RunnerQueueNoRun from './components/RunnerQueueNoRun';
import RunnerQueuePanelRun, { type RunPlacement } from './components/panel/RunnerQueuePanelRun';
import { RunOpenerCtx } from './context/runOpenerContext';
import { projectQueueScope } from './utils/queueScopes';

const RUN_MAX_W = 660;
// What a run takes at least to stand beside the list.
const RUN_MIN_W = 400;

// The project's agent runs in the side panel: the list, and the open run to the side of the
// panel, over the page, which leaves it `room`. A run stands in place of the list instead
// when the account prefers the compact view or there is no room for both. In full screen,
// `wide`, the list is a column and the run takes the rest of the screen.
export default function RunnerQueuePanel({
  project,
  wide,
  room,
  runId,
  onOpenRun,
}: {
  project: ProjectDetail;
  wide: boolean;
  room: number;
  runId: number | null;
  onOpenRun: (runId: number | null) => void;
}) {
  const t = useTranslations('issue.agentRuns');
  const scope = projectQueueScope(project.project.ref);
  const { agentRunsView } = useAccountPreferences();
  const updatePreferences = useUpdateAccountPreferences();
  const fits = !useIsMobile() && room >= RUN_MIN_W;
  let placement: RunPlacement = fits && agentRunsView === 'full' ? 'beside' : 'inPlace';
  if (wide) placement = 'page';
  const beside = placement === 'beside';

  // In the panel the run it already shows closes it, so its row puts it away again.
  const openRun = (id: number) => onOpenRun(!wide && id === runId ? null : id);

  const openedRun = runId != null && (
    <RunnerQueuePanelRun
      api={scope.api}
      runId={runId}
      placement={placement}
      onToggleView={
        fits && !wide
          ? () => updatePreferences.mutate({ agentRunsView: beside ? 'compact' : 'full' })
          : null
      }
      onClose={() => onOpenRun(null)}
    />
  );

  return (
    <RunOpenerCtx.Provider value={openRun}>
      {beside && openedRun && (
        <section
          aria-label={t('facts.run')}
          className="absolute inset-y-0 end-[calc(100%+1px)] -z-10 flex flex-col bg-background shadow-[var(--side-panel-shadow)] motion-safe:animate-in motion-safe:duration-250 motion-safe:slide-in-from-end-5 motion-safe:fade-in"
          style={{ width: Math.min(RUN_MAX_W, room) }}
        >
          {openedRun}
        </section>
      )}
      {placement === 'inPlace' && openedRun}
      {/* Hidden rather than dropped behind a run: that is what keeps its filters and
          its scroll. */}
      <div className={cn('flex min-h-0 flex-1', placement === 'inPlace' && openedRun && 'hidden')}>
        <ListColumn
          storageKey="agentRuns:list:width"
          minWidth={384}
          resizeLabel={t('resizeList')}
          fill={!wide}
          className="bg-rail"
        >
          <RunnerQueueList scope={scope} selectedId={runId} />
        </ListColumn>
        {wide && (
          <div className="flex min-w-0 flex-1 flex-col">{openedRun || <RunnerQueueNoRun />}</div>
        )}
      </div>
    </RunOpenerCtx.Provider>
  );
}
