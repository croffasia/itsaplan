'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { aiAgentsPath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/page/EmptyState';
import { AiChatAgentRail } from './components/page/AiChatAgentRail';
import { AiChatThreadRail } from './components/page/AiChatThreadRail';
import { AiChatConversation } from './components/page/AiChatConversation';
import { AiChatPageSkeleton } from './components/page/AiChatPageSkeleton';
import { useAiChatSelection } from './hooks/useAiChatSelection';

// The AI Chat page (/project/:projectKey/ai-team/chat): a full-page chat with the
// project's internal agents.
export default function AiChatPage() {
  const t = useTranslations('aiChat');
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
    handleThreadDeleted,
  } = useAiChatSelection(project?.project.key ?? null);

  if (!project) return null;

  if (!can('ai_agents', 'read')) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
        {t('noAccess')}
      </div>
    );
  }

  if (isLoading) return <AiChatPageSkeleton />;

  if (agents.length === 0) {
    return (
      <div className="flex h-full">
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')}>
          {can('ai_agents', 'edit') && (
            <Button asChild size="sm">
              <Link href={aiAgentsPath(project.project.key)}>{t('createAgent')}</Link>
            </Button>
          )}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <AiChatAgentRail
        agents={agents}
        selectedId={selected?.id ?? null}
        onSelect={selectAgent}
        providerLabel={providerLabel}
      />
      {selected && (
        <>
          <AiChatThreadRail
            key={selected.id}
            projectKey={project.project.key}
            agentId={selected.id}
            selectedThreadId={selectedThreadId}
            onSelect={selectThread}
            onDeleted={handleThreadDeleted}
            onNewChat={startNewChat}
          />
          <div className="flex min-h-0 flex-1 flex-col">
            <AiChatConversation
              key={`${selected.id}:${newChatNonce}`}
              projectKey={project.project.key}
              agent={selected}
              providerLabel={providerLabel}
              threadId={selectedThreadId}
              onThreadCreated={handleThreadCreated}
            />
          </div>
        </>
      )}
    </div>
  );
}
