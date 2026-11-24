import { useRef } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { useIsMobile } from '@/hooks/use-mobile';
import { useElementWidth } from '@/hooks/useElementWidth';
import { usePersistedWidth } from '@/hooks/usePersistedWidth';
import { sidePanelWidthKey, type SidePanelState, type SidePanelTab } from '@/hooks/useSidePanel';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import SidePanel from '@/components/layout/SidePanel';
import SidePanelHeader from '@/components/layout/SidePanelHeader';

// Their code, like their data, waits for the first open.
const ChatPanelBody = dynamic(() =>
  import('@/features/ai-chat/components/panel/ChatPanelBody').then((mod) => mod.ChatPanelBody),
);
const RunnerQueuePanel = dynamic(() => import('@/features/runner-queue/RunnerQueuePanel'));

const WIDTH = { initial: 400, min: 320, max: 720 };

// The project's agents in the side panel: the chat with them and their runs, a tab each.
// The Shell mounts it for every project page, so it survives a move to a different page.
export default function AgentsPanel({
  project,
  projectKey,
  panel,
  onClose,
  newChatAgentId,
  onNewChatHandled,
  runId,
  onOpenRun,
}: {
  project: ProjectDetail;
  projectKey: string;
  panel: SidePanelState;
  onClose: () => void;
  // An agent a page asked to chat with: the chat starts one with it and reports back.
  newChatAgentId: number | null;
  onNewChatHandled: () => void;
  runId: number | null;
  onOpenRun: (runId: number | null) => void;
}) {
  const t = useTranslations('nav');
  const tChat = useTranslations('aiChat');
  const { width, setWidth } = usePersistedWidth(
    sidePanelWidthKey(projectKey),
    WIDTH.initial,
    WIDTH.min,
    WIDTH.max,
  );
  const row = useRef<HTMLDivElement>(null);
  const room = useElementWidth(row) - width;
  const isMobile = useIsMobile();
  const wide = panel.fullscreen && !isMobile;

  // The chat loads the agents, the sessions and their transcripts, so it waits for the
  // first open: a chat nobody opens costs no requests. Once mounted it stays, hidden, so
  // its sessions are kept and a reply running in one goes on.
  const chatOpened = useRef(false);
  if (panel.open && panel.tab === 'chat') chatOpened.current = true;

  return (
    <>
      <div ref={row} aria-hidden className="pointer-events-none absolute inset-x-0 top-0" />
      <SidePanel
        label={t('agentsPanel')}
        resizeLabel={tChat('resizePanel')}
        open={panel.open}
        mode={panel.mode}
        fullscreen={panel.fullscreen}
        width={width}
        onWidthChange={setWidth}
      >
        <Tabs
          value={panel.tab}
          onValueChange={(tab) => panel.show(tab as SidePanelTab)}
          className="min-h-0 flex-1 gap-0"
        >
          <SidePanelHeader projectRef={project.project.ref} panel={panel} onClose={onClose} />
          <TabsContent
            value="chat"
            forceMount
            className="flex min-h-0 flex-col data-[state=inactive]:hidden"
          >
            {chatOpened.current && (
              <ChatPanelBody
                projectKey={projectKey}
                wide={wide}
                newChatAgentId={newChatAgentId}
                onNewChatHandled={onNewChatHandled}
              />
            )}
          </TabsContent>
          <TabsContent value="runs" className="flex min-h-0 flex-col">
            {panel.open && (
              <RunnerQueuePanel
                key={projectKey}
                project={project}
                wide={wide}
                room={room}
                runId={runId}
                onOpenRun={onOpenRun}
              />
            )}
          </TabsContent>
        </Tabs>
      </SidePanel>
    </>
  );
}
