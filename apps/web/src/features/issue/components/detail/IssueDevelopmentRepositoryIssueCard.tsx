import { CircleCheck, CircleDot, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LinkedRepositoryIssue } from '@/lib/api/endpoints/git';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';
import { Badge } from '@/components/ui/badge';
import { issueDevelopmentBadgeClassName } from './issueDevelopmentBadgeStyles';

// The repository issue this issue was created from by issue sync.
export default function IssueDevelopmentRepositoryIssueCard({
  issue,
}: {
  issue: LinkedRepositoryIssue;
}) {
  const t = useTranslations('issue.development');
  const reference = `${issue.repository}#${issue.number}`;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">
          {t('repositoryIssue', { provider: GIT_PROVIDER_CONFIG[issue.provider].label })}
        </p>
        {issue.url ? (
          <a
            href={issue.url}
            target="_blank"
            rel="noreferrer"
            dir="ltr"
            className="mt-1 flex items-center gap-1 text-sm font-medium hover:underline"
          >
            <span className="truncate">{reference}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ) : (
          <p dir="ltr" className="mt-1 truncate text-sm font-medium">
            {reference}
          </p>
        )}
      </div>
      {issue.state === 'open' ? (
        <Badge
          variant="outline"
          className={`${issueDevelopmentBadgeClassName} border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`}
        >
          <CircleDot />
          {t('open')}
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className={`${issueDevelopmentBadgeClassName} border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300`}
        >
          <CircleCheck />
          {t('closed')}
        </Badge>
      )}
    </div>
  );
}
