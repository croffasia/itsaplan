import { CircleCheck, CircleDot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LinkedRepositoryIssue } from '@/lib/api/endpoints/git';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';

// The repository issue this issue was created from by issue sync, shaped like the
// linked pull requests under it: an icon coloured by its state, the reference, and
// one line with the forge and the state.
export default function IssueDevelopmentRepositoryIssueRow({
  issue,
}: {
  issue: LinkedRepositoryIssue;
}) {
  const t = useTranslations('issue.development');
  const reference = `${issue.repository}#${issue.number}`;
  const open = issue.state === 'open';
  const Icon = open ? CircleDot : CircleCheck;
  return (
    <div className="flex items-start gap-2.5 rounded-md px-2 py-2 hover:bg-accent/50">
      <Icon
        className={`mt-0.5 size-4 shrink-0 ${open ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-600 dark:text-violet-400'}`}
      />
      <div className="min-w-0 flex-1">
        {issue.url ? (
          <a
            href={issue.url}
            target="_blank"
            rel="noreferrer"
            dir="ltr"
            className="block truncate text-sm hover:underline"
          >
            {reference}
          </a>
        ) : (
          <p dir="ltr" className="truncate text-sm">
            {reference}
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          {t('repositoryIssue', { provider: GIT_PROVIDER_CONFIG[issue.provider].label })} ·{' '}
          {open ? t('open') : t('closed')}
        </p>
      </div>
    </div>
  );
}
