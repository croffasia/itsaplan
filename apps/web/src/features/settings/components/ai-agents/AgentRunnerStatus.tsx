import { Radio } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDurationShort } from '@/utils/dates';

// A runner is considered online while it keeps polling; the reference runner polls
// every few seconds, so a gap this long means it is gone rather than between polls.
const ONLINE_WINDOW_MS = 90_000;

// Whether an external agent's runner is connected right now. The agent has no runner
// until someone starts one, so "never connected" is a normal state and reads
// differently from "went offline". `compact` drops to the bare state for places that
// already say what it is about, such as a section header.
export function AgentRunnerStatus({
  agent,
  compact = false,
}: {
  // Null while the agent is still being created: nothing can have connected yet.
  agent: AiAgent | null;
  compact?: boolean;
}) {
  const t = useTranslations('settings.agents');
  const lastSeen = agent?.lastSeenAt ?? null;
  const online = lastSeen != null && Date.now() - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS;

  let label: string;
  if (online) label = compact ? t('runnerStateOnline') : t('runnerOnline');
  else if (lastSeen) label = compact ? t('runnerStateOffline') : t('runnerOffline');
  else label = compact ? t('runnerStateNone') : t('runnerNever');

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Radio
        className={cn('size-3 shrink-0', online ? 'text-emerald-500' : 'text-muted-foreground/60')}
      />
      {label}
      {/* How long it has been gone is the useful half of "offline", so it survives
          the compact form — shortened to the bare duration. */}
      {!online && lastSeen && (
        <span className="text-muted-foreground/70">
          {compact
            ? `· ${formatDurationShort(lastSeen)}`
            : `· ${t('runnerSeen', { time: formatDurationShort(lastSeen) })}`}
        </span>
      )}
    </span>
  );
}
