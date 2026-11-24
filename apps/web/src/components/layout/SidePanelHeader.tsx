import { Maximize2, Minimize2, Pin, PinOff, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useIsMobile } from '@/hooks/use-mobile';
import type { SidePanelState } from '@/hooks/useSidePanel';
import { useRunningRunsQuery } from '@/services/runnerQueue.service';
import { Button } from '@/components/ui/button';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import WorkingCount from '@/components/common/WorkingCount';

const BUTTON = 'size-7 text-muted-foreground hover:text-foreground';

// The top row of the side panel: its tabs, the switch between docked and floating, where
// there is room for a docked panel, full screen and the close button.
export default function SidePanelHeader({
  projectRef,
  panel,
  onClose,
}: {
  projectRef: string;
  panel: SidePanelState;
  onClose: () => void;
}) {
  const t = useTranslations('nav');
  const tChat = useTranslations('aiChat');
  const tRuns = useTranslations('issue.agentRuns');
  const tCommon = useTranslations('common');
  const isMobile = useIsMobile();
  const docked = panel.mode === 'push';
  // The header's button keeps it live.
  const running = useRunningRunsQuery(projectRef, true).data ?? 0;

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b bg-background ps-3 pe-2.5">
      <TabsList
        variant="line"
        aria-label={t('agentsPanel')}
        className="h-full min-w-0 flex-1 border-b-0"
      >
        <TabsTrigger value="chat">{tChat('chatPanel')}</TabsTrigger>
        <TabsTrigger value="runs">
          {tRuns('queueTitle')}
          <WorkingCount count={running} label={t('runningRuns', { count: running })} />
        </TabsTrigger>
      </TabsList>
      {!isMobile && !panel.fullscreen && (
        <Button
          variant="ghost"
          size="icon"
          className={BUTTON}
          onClick={panel.toggleMode}
          title={tChat(docked ? 'overlayMode' : 'pushMode')}
          aria-pressed={docked}
        >
          {docked ? <PinOff /> : <Pin />}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className={BUTTON}
        onClick={panel.toggleFullscreen}
        title={tCommon(panel.fullscreen ? 'exitFullscreen' : 'fullscreen')}
        aria-pressed={panel.fullscreen}
      >
        {panel.fullscreen ? <Minimize2 /> : <Maximize2 />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={BUTTON}
        onClick={onClose}
        title={tCommon('close')}
      >
        <X />
      </Button>
    </div>
  );
}
