import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { waitsForRunner } from '../utils/waitsForRunner';

// One notice per pull agent with waiting runs and no runner connected. A push agent is
// left out: whether its endpoint is up is not known.
export default function RunnerQueueOfflineNotice({ runs }: { runs: RunnerQueueRun[] }) {
  const t = useTranslations('issue.agentRuns');
  const agents = new Map<number, { username: string; state: 'offline' | 'never' }>();
  for (const run of runs) {
    if (waitsForRunner(run)) {
      agents.set(run.agentId, { username: run.username, state: run.runnerState });
    }
  }
  if (agents.size === 0) return null;
  return (
    <div className="space-y-2 px-4 pb-1">
      {[...agents].map(([agentId, agent]) => (
        <div
          key={agentId}
          role="status"
          className="flex gap-2.5 rounded-lg border border-warning/35 bg-warning/10 px-3 py-2.5 text-sm"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-semibold">
              @{agent.username} · {t(`presence.${agent.state}`)}
            </p>
            <p className="text-muted-foreground">{t('offlineHint')}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
