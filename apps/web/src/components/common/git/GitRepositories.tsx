import { useTranslations } from 'next-intl';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import {
  useGitReachableRepositoriesQuery,
  useGitSyncedRepositoriesQuery,
  type GitRepositorySource,
} from '@/services/gitRepositories.service';
import GitAllRepositories from './GitAllRepositories';
import GitRepositoryRow from './GitRepositoryRow';

// The repositories behind a token that projects sync with. The rest it reaches open from
// a button, shown when the host lists more than one page or one no project syncs with.
export default function GitRepositories({ source }: { source: GitRepositorySource }) {
  const t = useTranslations('settings.git');
  const synced = useGitSyncedRepositoriesQuery(source);
  const reachable = useGitReachableRepositoriesQuery(source, '');
  const first = reachable.data?.pages[0];
  const unsynced =
    first !== undefined &&
    (first.nextPage !== null ||
      first.repositories.some((repository) => repository.projects.length === 0));

  return (
    <div className="flex flex-col">
      {synced.isPending && <ListSkeleton rows={2} rowClassName="h-4" className="py-1" />}
      {synced.data?.map((repository) => (
        <GitRepositoryRow key={repository.externalId} repository={repository} />
      ))}
      {synced.data?.length === 0 && (
        <p className="py-1.5 text-xs text-muted-foreground">{t('syncedRepositoriesEmpty')}</p>
      )}
      {reachable.isError && (
        <p className="py-1.5 text-xs text-destructive">{reachable.error.message}</p>
      )}
      {unsynced && (
        <div className="mt-2 border-t border-border/60 pt-2">
          <GitAllRepositories source={source} />
        </div>
      )}
    </div>
  );
}
