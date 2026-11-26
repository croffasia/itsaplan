import { useTranslations } from 'next-intl';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import type { ReachableGitRepositoryPage } from '@/lib/api/endpoints/git';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import GitRepositoryRow from './GitRepositoryRow';

// The repositories a token reaches, page by page from the host. The search shows once the
// list runs past one page.
export default function GitRepositoryList({
  query,
  search,
  onSearchChange,
  empty,
}: {
  query: UseInfiniteQueryResult<InfiniteData<ReachableGitRepositoryPage>>;
  search: string;
  onSearchChange: (search: string) => void;
  empty: string;
}) {
  const t = useTranslations('settings.git');
  const repositories = query.data?.pages.flatMap((page) => page.repositories) ?? [];
  const searchable = search !== '' || query.hasNextPage || (query.data?.pages.length ?? 0) > 1;

  return (
    <div className="flex flex-col">
      {searchable && (
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('nativeSearchRepositories')}
          aria-label={t('nativeSearchRepositories')}
          className="mb-1.5 h-8"
        />
      )}
      {query.isPending && <ListSkeleton rows={3} rowClassName="h-4" className="py-1" />}
      {query.isError && <p className="py-1.5 text-xs text-destructive">{query.error.message}</p>}
      {repositories.map((repository) => (
        <GitRepositoryRow key={repository.externalId} repository={repository} />
      ))}
      {query.isSuccess && repositories.length === 0 && !query.hasNextPage && (
        <p className="py-1.5 text-xs text-muted-foreground">{empty}</p>
      )}
      {query.hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className="-ms-3 self-start text-muted-foreground"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t('nativeLoadMore')}
        </Button>
      )}
    </div>
  );
}
