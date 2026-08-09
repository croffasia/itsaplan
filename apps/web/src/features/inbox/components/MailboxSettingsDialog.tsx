'use client';

import { useState } from 'react';
import type { MailboxSettings } from '@/lib/api';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDisconnectMailbox } from '../services/mailbox.service';
import MailboxSettingsForm from './MailboxSettingsForm';

export default function MailboxSettingsDialog({
  projectKey,
  settings,
  open,
  onOpenChange,
}: {
  projectKey: string;
  settings: MailboxSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const disconnect = useDisconnectMailbox(projectKey);
  const [confirming, setConfirming] = useState(false);

  const remove = async () => {
    await disconnect.mutateAsync();
    setConfirming(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Zoho mailbox settings</DialogTitle>
            <DialogDescription>
              The connection is tested before changes are stored. Passwords never return to the
              browser.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <MailboxSettingsForm
              projectKey={projectKey}
              settings={settings}
              onConnected={() => onOpenChange(false)}
            />
          </div>
          <div className="border-t pt-4">
            <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
              Disconnect mailbox
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {confirming && (
        <ConfirmDialog
          title="Disconnect this mailbox?"
          confirmLabel="Disconnect mailbox"
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        >
          <p className="text-sm text-muted-foreground">
            The encrypted connection credentials will be removed. Email remains in Zoho.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
