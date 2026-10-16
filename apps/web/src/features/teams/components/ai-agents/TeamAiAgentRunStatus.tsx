import { useTranslations } from 'next-intl';
import type { AgentRun } from '@/lib/api/endpoints/agents';
import { Badge } from '@/components/ui/badge';

const STATUS_VARIANT: Record<AgentRun['executionState'], 'secondary' | 'destructive' | 'outline'> =
  {
    success: 'secondary',
    failed: 'destructive',
    queued: 'outline',
    running: 'secondary',
    canceled: 'outline',
  };

export default function TeamAiAgentRunStatus({ status }: { status: AgentRun['executionState'] }) {
  const variant = STATUS_VARIANT[status];
  const t = useTranslations('issue.agentRuns');
  return (
    <Badge variant={variant} className="shrink-0 capitalize">
      {t(status)}
    </Badge>
  );
}
