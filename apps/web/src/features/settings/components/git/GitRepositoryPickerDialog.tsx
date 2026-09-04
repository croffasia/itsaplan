import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { GitProviderConnection } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  useAvailableGitRepositoriesQuery,
  useConnectGitRepositories,
} from '../../services/settings.service';

export default function GitRepositoryPickerDialog({
  projectKey,
  connection,
  open,
  onOpenChange,
}: {
  projectKey: string;
  connection: GitProviderConnection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('settings.git');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const repositoriesQuery = useAvailableGitRepositoriesQuery(
    projectKey,
    connection.id,
    debouncedSearch,
    open,
  );
  const connect = useConnectGitRepositories(projectKey, connection.id);
  const repositories = useMemo(
    () => repositoriesQuery.data?.pages.flatMap((page) => page.repositories) ?? [],
    [repositoriesQuery.data],
  );

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelected(new Set());
    }
  }, [open]);

  function toggle(externalId: string, checked: boolean) {
    setSelected((current) => {
      if (checked && current.size >= 50) {
        toast.error(t('nativeRepositoryLimit'));
        return current;
      }
      const next = new Set(current);
      if (checked) next.add(externalId);
      else next.delete(externalId);
      return next;
    });
  }

  async function submit() {
    try {
      await connect.mutateAsync([...selected]);
      toast.success(t('nativeRepositoriesConnected', { count: selected.size }));
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('nativeRepositoryConnectFailed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('nativeChooseRepositories')}</DialogTitle>
          <DialogDescription>
            {t('nativeChooseRepositoriesHint', { account: connection.accountLogin })}
          </DialogDescription>
        </DialogHeader>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('nativeSearchRepositories')}
        />
        <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border p-2">
          {repositoriesQuery.isPending && (
            <p className="p-3 text-sm text-muted-foreground">{t('nativeLoadingRepositories')}</p>
          )}
          {!repositoriesQuery.isPending && repositories.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">{t('nativeNoRepositories')}</p>
          )}
          {repositories.map((repository) => {
            const connected = repository.managedRepositoryId !== null;
            return (
              <label
                key={repository.externalId}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/60"
              >
                <Checkbox
                  checked={connected || selected.has(repository.externalId)}
                  disabled={connected}
                  onCheckedChange={(value) => toggle(repository.externalId, value === true)}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{repository.fullName}</span>
                <span className="text-xs text-muted-foreground">
                  {connected
                    ? t('nativeAlreadyConnected')
                    : repository.private
                      ? t('nativePrivate')
                      : t('nativePublic')}
                </span>
              </label>
            );
          })}
          {repositoriesQuery.hasNextPage && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={repositoriesQuery.isFetchingNextPage}
              onClick={() => void repositoriesQuery.fetchNextPage()}
            >
              {t('nativeLoadMore')}
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('nativeCancel')}
          </Button>
          <Button
            type="button"
            disabled={selected.size === 0 || connect.isPending}
            onClick={() => void submit()}
          >
            {connect.isPending
              ? t('nativeConnecting')
              : t('nativeConnectSelected', { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
