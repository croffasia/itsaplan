'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRenameAgentThread } from '@/services/aiAgents.service';
import { Input } from '@/components/ui/input';

// The title of a conversation, being typed in place of its tab. Enter and blur save it
// on the thread, Escape leaves it as it was.
export function ChatPanelTabRename({
  projectKey,
  agentId,
  threadId,
  title,
  onDone,
}: {
  projectKey: string;
  agentId: number;
  threadId: string;
  title: string;
  onDone: () => void;
}) {
  const t = useTranslations('aiChat');
  const rename = useRenameAgentThread(projectKey, agentId);
  const [draft, setDraft] = useState(title);

  const commit = () => {
    onDone();
    const next = draft.trim();
    if (next && next !== title) rename.mutate({ threadId, title: next });
  };

  return (
    <Input
      autoFocus
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
          setDraft(title);
          onDone();
        }
      }}
      className="h-auto w-40 border-0 bg-transparent px-2 py-1 text-xs shadow-none focus-visible:ring-0"
    />
  );
}
