'use client';

import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentActionLog } from './AgentActionLog';
import { AgentApprovals } from './AgentApprovals';

// What an agent did and what it waits to do: the action log and the approvals, in a
// right-side sidebar.
export function TeamAiAgentActionsSheet({
  agent,
  onClose,
}: {
  agent: AiAgent | null;
  onClose: () => void;
}) {
  const t = useTranslations('teams.agentActions');
  return (
    <Sheet open={agent != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription className="truncate text-xs">
            {agent ? `@${agent.username}` : ''}
          </SheetDescription>
        </SheetHeader>
        {agent && (
          <Tabs defaultValue="log" className="flex min-h-0 flex-1 flex-col gap-0">
            <TabsList variant="line" className="px-4">
              <TabsTrigger value="log">{t('logTab')}</TabsTrigger>
              <TabsTrigger value="approvals">{t('approvalsTab')}</TabsTrigger>
            </TabsList>
            <TabsContent value="log" className="flex min-h-0 flex-col">
              <AgentActionLog agentId={agent.id} />
            </TabsContent>
            <TabsContent value="approvals" className="flex min-h-0 flex-col">
              <AgentApprovals agent={agent} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
