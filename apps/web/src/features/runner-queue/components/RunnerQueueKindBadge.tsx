import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';

export default function RunnerQueueKindBadge({ kind }: { kind: RunnerQueueRun['kind'] }) {
  const t = useTranslations('teams.agents.kindLabel');
  return (
    <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px] font-medium">
      {t(kind)}
    </Badge>
  );
}
