import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DevelopmentCheck } from '@/lib/api/endpoints/git';
import IssueDevelopmentCiStatus from './IssueDevelopmentCiStatus';

export default function IssueDevelopmentChecks({ checks }: { checks: DevelopmentCheck[] }) {
  const t = useTranslations('issue.development');
  if (checks.length === 0) return null;

  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-muted-foreground/70 select-none hover:text-foreground">
        {t('checks', { count: checks.length })}
      </summary>
      <div className="mt-1.5 space-y-1">
        {checks.map((check) => (
          <div key={check.id} className="flex items-center justify-between gap-3 text-xs">
            {check.url ? (
              <a
                href={check.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-1 hover:underline"
              >
                <span className="truncate" dir="auto">
                  {check.name}
                </span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
            ) : (
              <span className="truncate" dir="auto">
                {check.name}
              </span>
            )}
            <IssueDevelopmentCiStatus status={check.status} />
          </div>
        ))}
      </div>
    </details>
  );
}
