import { useTranslations } from 'next-intl';

// The run's recorded attempts, to read any of them; nothing when there is one.
export default function AgentRunAttempts({
  count,
  current,
  onSelect,
}: {
  count: number;
  current: number;
  onSelect: (attempt: number) => void;
}) {
  const t = useTranslations('issue.agentRuns');
  if (count < 2) return null;
  return (
    <div
      role="group"
      aria-label={t('facts.attempts')}
      className="inline-flex flex-wrap gap-0.5 rounded-lg bg-muted p-0.5"
    >
      {Array.from({ length: count }, (_, index) => index + 1).map((attempt) => (
        <button
          key={attempt}
          type="button"
          aria-pressed={attempt === current}
          onClick={() => onSelect(attempt)}
          className="rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
        >
          {t('attemptNumber', { number: attempt })}
        </button>
      ))}
    </div>
  );
}
