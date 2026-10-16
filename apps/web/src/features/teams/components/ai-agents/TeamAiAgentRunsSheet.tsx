import type { AiAgent } from '@/lib/api/endpoints/agents';
import { useTranslations } from 'next-intl';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import TeamAiAgentRunsList from './TeamAiAgentRunsList';

export function TeamAiAgentRunsSheet({
  agent,
  onClose,
}: {
  agent: AiAgent | null;
  onClose: () => void;
}) {
  const t = useTranslations('teams.agents');
  return (
    <Sheet open={agent != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{t('runHistory')}</SheetTitle>
          <SheetDescription className="truncate text-xs">
            {agent ? t('runsSubtitle', { username: agent.username }) : ''}
          </SheetDescription>
        </SheetHeader>
        {agent && <TeamAiAgentRunsList agentId={agent.id} />}
      </SheetContent>
    </Sheet>
  );
}
