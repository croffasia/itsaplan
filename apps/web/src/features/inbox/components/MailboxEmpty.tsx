import { LockKeyhole, Mail } from 'lucide-react';
import type { MailboxSettings } from '@/lib/api';
import MailboxSettingsForm from './MailboxSettingsForm';

export default function MailboxEmpty({
  projectKey,
  settings,
  isOwner,
}: {
  projectKey: string;
  settings: MailboxSettings;
  isOwner: boolean;
}) {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-2xl rounded-lg border bg-card p-5 sm:p-6">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <Mail className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold">Connect Zoho Mail</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Read and send company email without leaving the dashboard.
            </p>
          </div>
        </div>
        {isOwner ? (
          <MailboxSettingsForm projectKey={projectKey} settings={settings} />
        ) : (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            <LockKeyhole className="size-4 shrink-0" />A project owner must connect the mailbox.
          </div>
        )}
      </div>
    </div>
  );
}
