import { useRunnerQueueRunQuery } from '@/services/runnerQueue.service';
import { cn } from '@/lib/utils';
import RunnerQueueRunDetail from '../RunnerQueueRunDetail';
import RunnerQueueRunLoader from '../RunnerQueueRunLoader';
import RunnerQueuePanelBar from './RunnerQueuePanelBar';

// Beside the list over the page, in place of the list, or next to it in full screen.
export type RunPlacement = 'beside' | 'inPlace' | 'page';

const PADDING: Record<RunPlacement, string> = {
  beside: 'px-8',
  inPlace: 'px-4',
  page: 'px-10',
};

// An open run of the side panel.
export default function RunnerQueuePanelRun({
  api,
  runId,
  placement,
  onToggleView,
  onClose,
}: {
  api: string;
  runId: number;
  placement: RunPlacement;
  onToggleView: (() => void) | null;
  onClose: () => void;
}) {
  const query = useRunnerQueueRunQuery(api, runId);
  const run = (query.isError ? null : query.data?.items[0]) ?? null;
  return (
    <>
      <RunnerQueuePanelBar
        runId={runId}
        run={run}
        placement={placement}
        onToggleView={onToggleView}
        onClose={onClose}
      />
      <div className={cn('min-h-0 flex-1 overflow-y-auto pt-2 pb-10', PADDING[placement])}>
        <RunnerQueueRunLoader api={api} runId={runId}>
          {(loaded) => (
            <RunnerQueueRunDetail key={loaded.id} run={loaded} withColumn={placement === 'page'} />
          )}
        </RunnerQueueRunLoader>
      </div>
    </>
  );
}
