import { Webhook } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GitRepository } from '@/lib/api/endpoints/git';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { Button } from '@/components/ui/button';

// A repository that delivers through a webhook made by hand. Connecting it through an
// account takes that webhook over and makes issue sync available.
export default function GitManualRepositoryRow({
  repository,
  onConnect,
}: {
  repository: GitRepository;
  onConnect: (() => void) | null;
}) {
  const t = useTranslations('settings.git');
  const relativeTime = useRelativeTime();

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Webhook className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p dir="ltr" className="truncate text-sm font-medium">
          {repository.repo}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {t('manualRepositoryMeta', {
            provider: repository.provider,
            ago: relativeTime(repository.lastEventAt),
          })}
        </p>
      </div>
      {onConnect && (
        <Button type="button" variant="outline" size="sm" onClick={onConnect}>
          {t('connectWithAccount')}
        </Button>
      )}
    </div>
  );
}
