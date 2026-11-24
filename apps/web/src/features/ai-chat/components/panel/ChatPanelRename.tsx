'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AiChatThread } from '@/lib/api/endpoints/agentChat';
import { useRenameChatThread } from '@/services/aiAgents.service';
import { Input } from '@/components/ui/input';

// The title of a conversation, being typed in place of its row in the list. Enter and
// blur save it on the thread, Escape leaves it as it was.
export function ChatPanelRename({
  projectKey,
  thread,
  onDone,
}: {
  projectKey: string;
  thread: AiChatThread;
  onDone: () => void;
}) {
  const t = useTranslations('aiChat');
  const rename = useRenameChatThread(projectKey);
  const title = thread.title ?? '';
  const [draft, setDraft] = useState(title);

  const commit = () => {
    onDone();
    const next = draft.trim();
    if (next && next !== title) rename.mutate({ thread, title: next });
  };

  return (
    <Input
      autoFocus
      data-chat-rename
      dir="auto"
      value={draft}
      maxLength={80}
      aria-label={t('renameThread')}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          onDone();
        }
      }}
      className="h-12"
    />
  );
}
