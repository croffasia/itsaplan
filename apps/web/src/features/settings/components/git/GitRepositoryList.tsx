import { useTranslations } from 'next-intl';
import type { GitRepository } from '@/lib/api';
import { useRelativeTime } from '@/context/relativeTimeContext';

// Every repository that has delivered to this project, newest first. The list
// makes an accidental connection visible: a repository nobody meant to connect
// shows up here as soon as it delivers.
export default function GitRepositoryList({ repositories }: { repositories: GitRepository[] }) {
  const t = useTranslations('settings.git');
  const relativeTime = useRelativeTime();

  return (
    <div className="space-y-3 p-4">
      {repositories.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('noDelivery')}</p>
      )}
      <ul className="space-y-2">
        {repositories.map((r) => (
          <li key={`${r.provider}/${r.repo}`} className="flex items-baseline justify-between gap-4">
            <span dir="ltr" className="font-mono text-xs">
              {r.repo}
            </span>
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              {t('repositoryMeta', {
                provider: r.provider,
                ago: relativeTime(r.lastEventAt),
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
