'use client';

import { useState } from 'react';
import { MessagesSquare, X } from 'lucide-react';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AiChatThread } from '../shared/AiChatThread';
import { FloatingChatHeader } from './FloatingChatHeader';
import { FloatingChatHistory } from './FloatingChatHistory';
import { useAiChatSelection } from '../../hooks/useAiChatSelection';

// The floating AI chat: a launcher button anchored to the corner and a chat window
// above it. It is mounted by the Shell while the header toggle is on, so the whole
// widget (and the conversation inside it) survives navigation between project pages.
// The window is hidden rather than unmounted when minimized, so a chat in progress is
// kept.
export function FloatingChat({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { project } = useShell();
  const { can } = usePermissions();
  const {
    agents,
    isLoading,
    providerLabel,
    selected,
    selectedThreadId,
    newChatNonce,
    selectAgent,
    selectThread,
    startNewChat,
    handleThreadCreated,
  } = useAiChatSelection(project?.project.key ?? null);

  const [view, setView] = useState<'chat' | 'history'>('chat');

  // Every way of changing the conversation also leaves the history layer.
  const handleSelectAgent = (id: number) => {
    selectAgent(id);
    setView('chat');
  };

  const handleSelectThread = (threadId: string) => {
    selectThread(threadId);
    setView('chat');
  };

  const handleNewChat = () => {
    startNewChat();
    setView('chat');
  };

  if (!project || !can('ai_agents', 'read')) return null;

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3">
      <div
        className={cn(
          'relative flex h-[32rem] max-h-[calc(100vh-7rem)] w-[calc(100vw-2rem)] max-w-96 flex-col overflow-hidden rounded-xl border bg-background shadow-xl',
          !open && 'hidden',
        )}
      >
        <FloatingChatHeader
          agents={agents}
          providerLabel={providerLabel}
          selected={selected}
          onSelectAgent={handleSelectAgent}
          onShowHistory={() => setView('history')}
          onNewChat={handleNewChat}
          onMinimize={() => onOpenChange(false)}
        />

        <div className="relative min-h-0 flex-1">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : selected ? (
            <AiChatThread
              key={`${selected.id}:${newChatNonce}`}
              projectKey={project.project.key}
              agent={selected}
              threadId={selectedThreadId}
              onThreadCreated={handleThreadCreated}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              No internal agents to chat with yet.
            </div>
          )}

          {/* History over the conversation, which stays mounted so a chat in progress
              is kept when the list is opened and closed without picking a thread. */}
          {view === 'history' && selected && (
            <div className="absolute inset-0 bg-background">
              <FloatingChatHistory
                projectKey={project.project.key}
                agentId={selected.id}
                selectedThreadId={selectedThreadId}
                onSelect={handleSelectThread}
                onBack={() => setView('chat')}
              />
            </div>
          )}
        </div>
      </div>

      <Button
        size="icon"
        className="size-12 shrink-0 rounded-full shadow-lg"
        title={open ? 'Hide chat' : 'Open chat'}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        {open ? <X className="size-5" /> : <MessagesSquare className="size-5" />}
        <span className="sr-only">{open ? 'Hide chat' : 'Open chat'}</span>
      </Button>
    </div>
  );
}
