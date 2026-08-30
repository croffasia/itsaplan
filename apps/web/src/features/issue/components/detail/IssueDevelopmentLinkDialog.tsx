import { useEffect, useMemo, useState } from 'react';
import { Check, GitPullRequest } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useIssueDevelopmentRepositoriesQuery,
  useLinkablePullRequestsQuery,
  useLinkIssueDevelopment,
} from '@/services/issues.service';

export default function IssueDevelopmentLinkDialog({
  issueId,
  open,
  onOpenChange,
}: {
  issueId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('issue.development');
  const repositoriesQuery = useIssueDevelopmentRepositoriesQuery(issueId, open);
  const [repositoryId, setRepositoryId] = useState<number | null>(null);
  const [state, setState] = useState<'open' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const pullRequestsQuery = useLinkablePullRequestsQuery(issueId, repositoryId, state, open);
  const link = useLinkIssueDevelopment(issueId);
  const pullRequests = useMemo(
    () => pullRequestsQuery.data?.pages.flatMap((page) => page.pullRequests) ?? [],
    [pullRequestsQuery.data],
  );
  const needle = search.trim().toLowerCase();
  const visiblePullRequests = pullRequests.filter(
    (pullRequest) =>
      !needle ||
      pullRequest.title.toLowerCase().includes(needle) ||
      pullRequest.sourceBranch?.toLowerCase().includes(needle) ||
      String(pullRequest.number).includes(needle),
  );

  useEffect(() => {
    if (open && repositoryId === null && repositoriesQuery.data?.[0])
      setRepositoryId(repositoriesQuery.data[0].id);
    if (!open) {
      setRepositoryId(null);
      setState('open');
      setSearch('');
      setSelectedNumber(null);
    }
  }, [open, repositoryId, repositoriesQuery.data]);

  async function submit() {
    if (repositoryId === null || selectedNumber === null) return;
    try {
      await link.mutateAsync({ repositoryId, number: selectedNumber });
      toast.success(t('linkedSuccess'));
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('linkFailed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('linkExisting')}</DialogTitle>
          <DialogDescription>{t('linkExistingDescription')}</DialogDescription>
        </DialogHeader>
        {repositoriesQuery.isPending ? (
          <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {t('loadingRepositories')}
          </div>
        ) : repositoriesQuery.data?.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {t('noConnectedRepositories')}
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Select
                value={repositoryId === null ? undefined : String(repositoryId)}
                onValueChange={(value) => {
                  setRepositoryId(Number(value));
                  setSelectedNumber(null);
                }}
              >
                <SelectTrigger className="min-w-0 flex-1 rounded-md">
                  <SelectValue placeholder={t('chooseRepository')} />
                </SelectTrigger>
                <SelectContent>
                  {repositoriesQuery.data?.map((repository) => (
                    <SelectItem key={repository.id} value={String(repository.id)}>
                      {repository.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex rounded-md border p-0.5">
                {(['open', 'all'] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={state === value ? 'secondary' : 'ghost'}
                    className="h-7 rounded-sm px-2.5"
                    onClick={() => {
                      setState(value);
                      setSelectedNumber(null);
                    }}
                  >
                    {t(value === 'open' ? 'openOnly' : 'allPullRequests')}
                  </Button>
                ))}
              </div>
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchPullRequests')}
            />
            <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border p-1.5">
              {pullRequestsQuery.isPending && (
                <p className="p-3 text-sm text-muted-foreground">{t('loadingPullRequests')}</p>
              )}
              {!pullRequestsQuery.isPending && visiblePullRequests.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">{t('noPullRequests')}</p>
              )}
              {visiblePullRequests.map((pullRequest) => (
                <button
                  key={pullRequest.number}
                  type="button"
                  disabled={pullRequest.linked}
                  className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-start hover:bg-muted/60 disabled:opacity-60"
                  onClick={() => setSelectedNumber(pullRequest.number)}
                >
                  <GitPullRequest className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium" dir="auto">
                      {pullRequest.title}
                    </span>
                    <span
                      className="block truncate font-mono text-[11px] text-muted-foreground"
                      dir="ltr"
                    >
                      #{pullRequest.number} · {pullRequest.sourceBranch ?? '?'} →{' '}
                      {pullRequest.targetBranch}
                    </span>
                  </span>
                  {pullRequest.linked ? (
                    <span className="text-xs text-muted-foreground">{t('alreadyLinked')}</span>
                  ) : selectedNumber === pullRequest.number ? (
                    <Check className="mt-0.5 size-4 text-primary" />
                  ) : null}
                </button>
              ))}
              {pullRequestsQuery.hasNextPage && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={pullRequestsQuery.isFetchingNextPage}
                  onClick={() => void pullRequestsQuery.fetchNextPage()}
                >
                  {t('loadMore')}
                </Button>
              )}
            </div>
          </>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            disabled={selectedNumber === null || link.isPending}
            onClick={() => void submit()}
          >
            {link.isPending ? t('linking') : t('linkPullRequest')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
