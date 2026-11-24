import { useTranslations } from 'next-intl';
import type { AiChatThread } from '@/lib/api/endpoints/agentChat';
import { useDeleteChatThread } from '@/services/aiAgents.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';

// Asks before a conversation is deleted.
export function ChatPanelDelete({
  projectKey,
  thread,
  onDeleted,
  onClose,
}: {
  projectKey: string;
  thread: AiChatThread;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('aiChat');
  const tCommon = useTranslations('common');
  const deleteThread = useDeleteChatThread(projectKey);

  async function confirm() {
    await deleteThread.mutateAsync(thread);
    onClose();
    onDeleted();
  }

  return (
    <ConfirmDialog
      title={t('deleteThread')}
      confirmLabel={tCommon('delete')}
      onConfirm={confirm}
      onClose={onClose}
    >
      <div className="text-sm text-muted-foreground">
        {t('deleteThreadConfirm', { title: thread.title ?? t('untitledThread') })}
      </div>
    </ConfirmDialog>
  );
}
