'use client';

import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useStripSortSensors } from '@/lib/dnd';
import { Button } from '@/components/ui/button';
import { ChatPanelTab } from './ChatPanelTab';
import { ChatPanelTabFavorite } from './ChatPanelTabFavorite';
import { ChatPanelTabSortable } from './ChatPanelTabSortable';
import { ChatPanelTabsOverflow } from './ChatPanelTabsOverflow';
import { useTabOverflow } from '../../hooks/useTabOverflow';
import type { ChatSession } from '../../hooks/useChatSessions';

// The open sessions of the panel, with the control that opens one more. The row shows
// the tabs it has width for and lists the rest in a menu.
export function ChatPanelTabs({
  projectKey,
  sessions,
  activeId,
  onSelect,
  onClose,
  onNewTab,
  onMoveTab,
  onSwapTabs,
}: {
  projectKey: string;
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNewTab: () => void;
  onMoveTab: (id: string, overId: string) => void;
  onSwapTabs: (id: string, otherId: string) => void;
}) {
  const t = useTranslations('aiChat');
  const sensors = useStripSortSensors();
  const { rowRef, measureRef, visible, hidden } = useTabOverflow(sessions, activeId);
  const lastVisibleId = visible[visible.length - 1]?.id ?? null;
  const active = sessions.find((session) => session.id === activeId);

  // Selecting from the menu shows that chat in the last slot of the row; the swap is
  // what keeps it there afterwards.
  const selectHidden = (id: string) => {
    if (lastVisibleId) onSwapTabs(id, lastVisibleId);
    onSelect(id);
  };

  return (
    <div className="relative z-10 flex items-center gap-1 border-b px-2 py-1 shadow-[var(--chat-tabs-shadow)]">
      <div ref={rowRef} className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }: DragEndEvent) => {
            if (over && active.id !== over.id) onMoveTab(String(active.id), String(over.id));
          }}
        >
          <SortableContext
            items={visible.map((session) => session.id)}
            strategy={horizontalListSortingStrategy}
          >
            {visible.map((session) => (
              <ChatPanelTabSortable
                key={session.id}
                projectKey={projectKey}
                session={session}
                active={session.id === activeId}
                onSelect={() => onSelect(session.id)}
                onClose={() => onClose(session.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {hidden.length > 0 && (
        <ChatPanelTabsOverflow
          projectKey={projectKey}
          sessions={hidden}
          activeId={activeId}
          onSelect={selectHidden}
          onClose={onClose}
        />
      )}

      {/* A chat that has not started has no thread, and neither has one with an agent
          that keeps no memory, so there is nothing to star for either. */}
      {active?.threadId && (
        <ChatPanelTabFavorite
          projectKey={projectKey}
          agentId={active.agentId}
          threadId={active.threadId}
        />
      )}

      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
        title={t('newChat')}
        onClick={onNewTab}
      >
        <Plus />
        <span className="sr-only">{t('newChat')}</span>
      </Button>

      <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute flex">
        {sessions.map((session) => (
          <ChatPanelTab
            key={session.id}
            projectKey={projectKey}
            session={session}
            active={false}
            onSelect={() => {}}
            onClose={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
