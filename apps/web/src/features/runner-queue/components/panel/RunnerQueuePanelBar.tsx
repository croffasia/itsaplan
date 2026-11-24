import { ArrowLeft, Maximize2, MessageSquare, Minimize2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { useShell } from '@/context/shellContext';
import { useProjectAgents } from '@/hooks/useProjectAgents';
import { Button } from '@/components/ui/button';
import { runPath } from '../../utils/runPath';
import RunnerQueueCopyLink from '../RunnerQueueCopyLink';
import type { RunPlacement } from './RunnerQueuePanelRun';

const BUTTON = 'size-7 text-muted-foreground hover:text-foreground';

// The row over an open run: the way back to the list it stands in place of, and what is
// done with the run as a whole.
export default function RunnerQueuePanelBar({
  runId,
  run,
  placement,
  onToggleView,
  onClose,
}: {
  runId: number;
  // Null until it is loaded.
  run: RunnerQueueRun | null;
  placement: RunPlacement;
  // Null where there is no room for the other view.
  onToggleView: (() => void) | null;
  onClose: () => void;
}) {
  const t = useTranslations('issue.agentRuns');
  const tCommon = useTranslations('common');
  const { onChatWithAgent } = useShell();
  const agent = useProjectAgents().data?.find((one) => one.id === run?.agentId && one.chatEnabled);
  const beside = placement === 'beside';
  const viewLabel = t(beside ? 'compactView' : 'fullView');

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 ps-3 pe-2.5">
      {placement === 'inPlace' && (
        <Button
          variant="ghost"
          size="icon"
          className={BUTTON}
          title={tCommon('back')}
          onClick={onClose}
        >
          <ArrowLeft className="rtl:rotate-180" />
        </Button>
      )}
      <span className="mx-1 min-w-0 flex-1 truncate text-[13px] text-muted-foreground tabular-nums">
        {t('runNumber', { id: runId })}
      </span>
      {run && <RunnerQueueCopyLink path={runPath(run)} className={BUTTON} />}
      {agent && (
        <Button
          variant="ghost"
          size="icon"
          className={BUTTON}
          title={tCommon('agentChat.title', { agent: agent.name })}
          onClick={() => onChatWithAgent(agent.id)}
        >
          <MessageSquare />
        </Button>
      )}
      {onToggleView && (
        <Button
          variant="ghost"
          size="icon"
          className={BUTTON}
          title={viewLabel}
          onClick={onToggleView}
        >
          {beside ? <Minimize2 /> : <Maximize2 />}
        </Button>
      )}
      {beside && (
        <Button
          variant="ghost"
          size="icon"
          className={BUTTON}
          title={tCommon('close')}
          onClick={onClose}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
