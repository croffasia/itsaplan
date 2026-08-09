'use client';

import { useShell } from '@/context/shellContext';
import { Bell, Mail } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InboxView from './components/InboxView';
import MailboxView from './components/MailboxView';

// The project Inbox combines the shared Zoho mailbox with the session user's own
// project notifications. Mail stays hidden when the role has no mail permission.
export default function InboxPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  if (!project) return null;
  const canReadMail = can('mail', 'read');
  return (
    <Tabs
      key={project.project.key}
      defaultValue={canReadMail ? 'mail' : 'notifications'}
      className="h-full min-h-0 gap-0"
    >
      {canReadMail && (
        <div className="shrink-0 border-b px-4 pt-1">
          <TabsList variant="line" className="w-auto border-b-0">
            <TabsTrigger value="mail">
              <Mail />
              Mail
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell />
              Notifications
            </TabsTrigger>
          </TabsList>
        </div>
      )}
      {canReadMail && (
        <TabsContent value="mail" className="min-h-0 overflow-hidden">
          <MailboxView projectKey={project.project.key} />
        </TabsContent>
      )}
      <TabsContent value="notifications" className="min-h-0 overflow-hidden">
        <InboxView project={project} />
      </TabsContent>
    </Tabs>
  );
}
