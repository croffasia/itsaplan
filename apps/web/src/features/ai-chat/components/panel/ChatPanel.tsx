'use client';

import { useRef } from 'react';
import { Maximize2, Minimize2, Pin, PinOff, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Direction } from 'radix-ui';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePersistedWidth } from '@/hooks/usePersistedWidth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ResizeGrip from '@/components/common/ResizeGrip';
import { ChatPanelBody } from './ChatPanelBody';
import { chatPanelWidthKey, type ChatPanelMode } from '../../hooks/useChatPanel';

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
// narrower page, so it is always overlay, over the full width. Fullscreen takes the
// panel out of the content row and over the whole viewport, the same way a dialog
// expands.
export function ChatPanel({
  projectKey,
  open,
  mode,
  fullscreen,
  onToggleMode,
  onToggleFullscreen,
  onClose,
}: {
  projectKey: string;
  open: boolean;
  mode: ChatPanelMode;
  fullscreen: boolean;
  onToggleMode: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('aiChat');
  const tCommon = useTranslations('common');
  const direction = Direction.useDirection();
  const isMobile = useIsMobile();
  const { width, setWidth } = usePersistedWidth(
    chatPanelWidthKey(projectKey),
    DEFAULT_WIDTH,
    MIN_WIDTH,
    MAX_WIDTH,
  );

  const overlay = isMobile || mode === 'overlay';

  // The body is what loads the agents, the tabs and their transcripts, so it waits for
  // the first open: a panel nobody opens costs no requests. Once mounted it stays, which
  // is what keeps a running reply alive while the panel is closed.
  const opened = useRef(false);
  if (open) opened.current = true;

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col bg-background',
        !open && 'hidden',
        fullscreen
          ? 'fixed inset-0 z-50'
          : cn(
              'border-s',
              overlay
                ? 'absolute inset-y-0 end-0 z-30 shadow-[var(--side-panel-shadow)]'
                : 'relative shrink-0',
            ),
      )}
      style={fullscreen ? undefined : { width: isMobile ? '100%' : width }}
    >
      {!isMobile && !fullscreen && (
        <ResizeGrip
          label={t('resizePanel')}
          className="absolute inset-y-0 start-0 z-10"
          onDrag={(deltaX) => setWidth(width + (direction === 'rtl' ? deltaX : -deltaX))}
        />
      )}

      <div className="flex items-center gap-1 border-b px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{t('chatPanel')}</span>
        {!isMobile && !fullscreen && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={onToggleMode}
            title={t(mode === 'push' ? 'overlayMode' : 'pushMode')}
            aria-pressed={mode === 'push'}
          >
            {mode === 'push' ? <PinOff /> : <Pin />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={onToggleFullscreen}
          title={tCommon(fullscreen ? 'exitFullscreen' : 'fullscreen')}
          aria-pressed={fullscreen}
        >
          {fullscreen ? <Minimize2 /> : <Maximize2 />}
        </Button>
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

      {opened.current && <ChatPanelBody projectKey={projectKey} />}
    </aside>
  );
}
