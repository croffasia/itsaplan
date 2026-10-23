import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { useInvocationSecretQuery, useRotateInvocationSecret } from '@/services/aiAgents.service';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { useAgentSection } from '../../context/agentSection';
import AgentKeyValue from './AgentKeyValue';

// The key the endpoint checks every request against. Unlike the API key it is kept
// readable, because the server signs each request with it.
export default function AgentInvocationSecret({ agent }: { agent: AiAgent }) {
  const t = useTranslations('teams.agents');
  const { teamId } = useAgentSection();
  const secret = useInvocationSecretQuery(teamId, agent.id).data?.secret ?? null;
  const rotate = useRotateInvocationSecret(teamId);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="block text-sm font-medium">{t('invocationSecret')}</span>
          <span className="block text-xs text-muted-foreground">{t('invocationSecretHint')}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={rotate.isPending}
          onClick={() => setConfirming(true)}
        >
          <RefreshCw className="size-3.5" />
          {t('invocationRotate')}
        </Button>
      </div>
      <div className="rounded-md bg-muted/50 p-1.5">
        {secret ? <AgentKeyValue apiKey={secret} /> : <Skeleton className="h-8 w-full" />}
      </div>

      {confirming && (
        <ConfirmDialog
          title={t('invocationRotateTitle')}
          confirmLabel={t('invocationRotate')}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            await rotate.mutateAsync(agent.id);
            setConfirming(false);
          }}
        >
          <p className="text-sm text-muted-foreground">
            {t.rich('invocationRotateMessage', {
              name: agent.name,
              v: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
