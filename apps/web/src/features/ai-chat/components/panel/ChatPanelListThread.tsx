import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AiChatThread } from '@/lib/api/endpoints/agentChat';
import { useToggleChatThreadFavorite } from '@/services/aiAgents.service';
import { dayKey, formatShortDate, formatTime } from '@/utils/dates';
import { ChatPanelListActions } from './ChatPanelListActions';
import { ChatPanelListItem } from './ChatPanelListItem';
import { ChatPanelRename } from './ChatPanelRename';

// A saved conversation in the list, with what is done with it from there.
export function ChatPanelListThread({
  projectKey,
  thread,
  agentName,
  active,
  query,
  onSelect,
  onDelete,
}: {
  projectKey: string;
  thread: AiChatThread;
  agentName: string;
  active: boolean;
  query: string;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('aiChat');
  const toggleFavorite = useToggleChatThreadFavorite(projectKey);
  const [renaming, setRenaming] = useState(false);

  if (renaming) {
    return (
      <ChatPanelRename projectKey={projectKey} thread={thread} onDone={() => setRenaming(false)} />
    );
  }
  const isToday = dayKey(thread.updatedAt) === dayKey(new Date().toISOString());
  return (
    <ChatPanelListItem
      title={thread.title ?? t('untitledThread')}
      agentName={agentName}
      snippet={thread.snippet}
      when={isToday ? formatTime(thread.updatedAt) : formatShortDate(thread.updatedAt)}
      active={active}
      query={query}
      onSelect={onSelect}
      actions={
        <ChatPanelListActions
          favorite={thread.favorite}
          onRename={() => setRenaming(true)}
          onToggleFavorite={() => toggleFavorite.mutate({ thread, favorite: !thread.favorite })}
          onDelete={onDelete}
        />
      }
    />
  );
}
