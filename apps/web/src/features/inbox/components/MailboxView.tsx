'use client';

import { useEffect, useState } from 'react';
import type { MailMessage, MailMessageSummary } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import MailboxComposeDialog from './MailboxComposeDialog';
import MailboxDetail from './MailboxDetail';
import MailboxEmpty from './MailboxEmpty';
import MailboxList from './MailboxList';
import MailboxSettingsDialog from './MailboxSettingsDialog';
import MailboxToolbar from './MailboxToolbar';
import {
  useMailboxMessage,
  useMailboxMessages,
  useMailboxSettings,
  useMarkMailboxRead,
} from '../services/mailbox.service';

export default function MailboxView({ projectKey }: { projectKey: string }) {
  const { can, isOwner } = usePermissions();
  const mobile = useIsMobile();
  const settingsQuery = useMailboxSettings(projectKey);
  const connected = settingsQuery.data?.connected === true;
  const messagesQuery = useMailboxMessages(projectKey, connected);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const messageQuery = useMailboxMessage(projectKey, selectedUid);
  const markRead = useMarkMailboxRead(projectKey);
  const [composeOpen, setComposeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reply, setReply] = useState<MailMessage | null>(null);

  useEffect(() => {
    if (!connected) setSelectedUid(null);
  }, [connected]);

  if (settingsQuery.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        Could not load the mailbox connection.
        <Button variant="outline" size="sm" onClick={() => settingsQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (settingsQuery.isLoading || !settingsQuery.data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading mailbox…
      </div>
    );
  }
  if (!connected) {
    return <MailboxEmpty projectKey={projectKey} settings={settingsQuery.data} isOwner={isOwner} />;
  }

  const selectMessage = (message: MailMessageSummary) => {
    setSelectedUid(message.uid);
    if (message.unread && can('mail', 'edit')) markRead.mutate(message.uid);
  };
  const openCompose = () => {
    setReply(null);
    setComposeOpen(true);
  };
  const openReply = (message: MailMessage) => {
    setReply(message);
    setComposeOpen(true);
  };

  return (
    <div className="flex h-full min-h-0">
      <div
        className={cn(
          'flex w-full min-w-0 flex-col md:max-w-sm md:border-r',
          selectedUid != null && 'hidden md:flex',
        )}
      >
        <MailboxToolbar
          email={settingsQuery.data.email}
          canSend={can('mail', 'create')}
          isOwner={isOwner}
          refreshing={messagesQuery.isFetching}
          onCompose={openCompose}
          onRefresh={() => messagesQuery.refetch()}
          onSettings={() => setSettingsOpen(true)}
        />
        <MailboxList
          messages={messagesQuery.data ?? []}
          selectedUid={selectedUid}
          loading={messagesQuery.isLoading}
          error={messagesQuery.isError}
          onSelect={selectMessage}
          onRetry={() => messagesQuery.refetch()}
        />
      </div>

      {selectedUid != null ? (
        <MailboxDetail
          message={messageQuery.data}
          loading={messageQuery.isLoading}
          error={messageQuery.isError}
          mobile={mobile}
          canReply={can('mail', 'create')}
          onBack={() => setSelectedUid(null)}
          onReply={openReply}
          onRetry={() => messageQuery.refetch()}
        />
      ) : (
        <div className="hidden flex-1 items-center justify-center text-sm text-muted-foreground md:flex">
          Select an email
        </div>
      )}

      <MailboxComposeDialog
        projectKey={projectKey}
        open={composeOpen}
        reply={reply}
        onOpenChange={setComposeOpen}
      />
      <MailboxSettingsDialog
        projectKey={projectKey}
        settings={settingsQuery.data}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </div>
  );
}
