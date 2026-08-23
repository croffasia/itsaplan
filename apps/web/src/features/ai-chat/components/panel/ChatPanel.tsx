'use client';

import { Columns2, PanelRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Direction } from 'radix-ui';
import { useAiAgentsQuery } from '@/services/aiAgents.service';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePersistedWidth } from '@/hooks/usePersistedWidth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ResizeGrip from '@/components/common/ResizeGrip';
import { AiChatThreadSkeleton } from '../shared/AiChatThreadSkeleton';
import { ChatPanelSession } from './ChatPanelSession';
import { chatPanelWidthKey, type ChatPanelMode } from '../../hooks/useChatPanel';
import { useChatSessions } from '../../hooks/useChatSessions';

const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 320;
const MAX_WIDTH = 720;

// The agent chat as a panel on the end edge of the content area. The Shell mounts it
// for every project page, so the panel and the sessions in it survive a move to a
// different page: a closed panel is hidden, not unmounted, and a reply running in it
// goes on.
//
// In push mode the panel is a column of the content row, which narrows the page next to
// it; in overlay mode it stands over that page. A narrow screen has no room for a
// narrower page, so it is always overlay, over the full width.
export function ChatPanel({
  projectKey,
  open,
  mode,
  onToggleMode,
  onClose,
}: {
  projectKey: string;
  open: boolean;
  mode: ChatPanelMode;
  onToggleMode: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('aiChat');
  const tCommon = useTranslations('common');
  const direction = Direction.useDirection();
  const isMobile = useIsMobile();
  const agentsQuery = useAiAgentsQuery(projectKey);
  const agents = agentsQuery.data ?? [];
  const { sessions, active, setThread, setRunning } = useChatSessions(
    projectKey,
    agents[0]?.id ?? null,
  );
  const { width, setWidth } = usePersistedWidth(
    chatPanelWidthKey(projectKey),
    DEFAULT_WIDTH,
    MIN_WIDTH,
    MAX_WIDTH,
  );

  const overlay = isMobile || mode === 'overlay';

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col border-s bg-background',
        !open && 'hidden',
        // The panel carries the same surface as the page, so standing over it is read
        // from the shadow it casts on the content next to it.
        overlay
          ? 'absolute inset-y-0 end-0 z-30 shadow-[var(--side-panel-shadow)]'
          : 'relative shrink-0',
      )}
      style={{ width: isMobile ? '100%' : width }}
    >
      {!isMobile && (
        <ResizeGrip
          label={t('resizePanel')}
          className="absolute inset-y-0 start-0 z-10"
          // The panel grows towards the content, so the pointer moving away from the
          // edge it sits on is what widens it.
          onDrag={(deltaX) => setWidth(width + (direction === 'rtl' ? deltaX : -deltaX))}
        />
      )}

      <div className="flex items-center gap-1 border-b px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{t('chatPanel')}</span>
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={onToggleMode}
            title={t(mode === 'push' ? 'overlayMode' : 'pushMode')}
            aria-pressed={mode === 'push'}
          >
            {mode === 'push' ? <Columns2 /> : <PanelRight />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          title={tCommon('close')}
        >
          <X />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        {agentsQuery.isLoading ? (
          <AiChatThreadSkeleton />
        ) : agents.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {t('noAgentsYet')}
          </div>
        ) : (
          sessions.map((session) => {
            const agent = agents.find((candidate) => candidate.id === session.agentId);
            if (!agent) return null;
            return (
              <ChatPanelSession
                key={session.id}
                projectKey={projectKey}
                agent={agent}
                session={session}
                active={session.id === active?.id}
                onThreadCreated={setThread}
                onRunningChange={setRunning}
              />
            );
          })
        )}
      </div>
    </aside>
  );
}
