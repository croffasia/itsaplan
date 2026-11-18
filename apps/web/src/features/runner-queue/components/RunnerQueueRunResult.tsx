import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import Markdown from '@/components/common/Markdown';
import { runLinks } from '../utils/runLinks';
import RunnerQueueCopyButton from './RunnerQueueCopyButton';
import RunnerQueueRunLinkRow from './RunnerQueueRunLinkRow';

// The run's answer in one card: a row for each page of the workspace it links to, then
// its text.
export default function RunnerQueueRunResult({ run }: { run: RunnerQueueRun }) {
  const t = useTranslations('issue.agentRuns');
  const output = run.output;
  const links = useMemo(
    () => (output && typeof window !== 'undefined' ? runLinks(output, window.location.origin) : []),
    [output],
  );
  if (!output) {
    const pending = run.executionState === 'queued' || run.executionState === 'running';
    return (
      <p className="text-sm text-muted-foreground">{t(pending ? 'noResultYet' : 'noResult')}</p>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-xl bg-card p-3">
      <div className="min-w-0 flex-1 space-y-3">
        {links.map((url) => (
          <RunnerQueueRunLinkRow key={url} url={url} />
        ))}
        {output.startsWith('…') && (
          <p className="text-xs text-muted-foreground">{t('outputTail')}</p>
        )}
        <div className="-my-1.5">
          <Markdown>{output}</Markdown>
        </div>
      </div>
      <RunnerQueueCopyButton text={output} />
    </div>
  );
}
