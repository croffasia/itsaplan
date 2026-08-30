import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateIssuePullRequest,
  useDevelopmentBranchesQuery,
  useIssueDevelopmentRepositoriesQuery,
} from '@/services/issues.service';

export default function IssueDevelopmentCreateDialog({
  issueId,
  identifier,
  issueTitle,
  open,
  onOpenChange,
}: {
  issueId: number;
  identifier: string;
  issueTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('issue.development');
  const repositoriesQuery = useIssueDevelopmentRepositoriesQuery(issueId, open);
  const [repositoryId, setRepositoryId] = useState<number | null>(null);
  const branchesQuery = useDevelopmentBranchesQuery(issueId, repositoryId, open);
  const branches = useMemo(
    () => [...new Set(branchesQuery.data?.pages.flatMap((page) => page.branches) ?? [])],
    [branchesQuery.data],
  );
  const defaultBranch = branchesQuery.data?.pages[0]?.defaultBranch ?? null;
  const [sourceBranch, setSourceBranch] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [relation, setRelation] = useState<'closes' | 'references'>('closes');
  const [draft, setDraft] = useState(true);
  const create = useCreateIssuePullRequest(issueId);

  useEffect(() => {
    if (open && repositoryId === null && repositoriesQuery.data?.[0])
      setRepositoryId(repositoriesQuery.data[0].id);
    if (!open) {
      setRepositoryId(null);
      setSourceBranch('');
      setTargetBranch('');
      setTitle('');
      setNotes('');
      setRelation('closes');
      setDraft(true);
    }
  }, [open, repositoryId, repositoriesQuery.data]);

  useEffect(() => {
    if (!open) return;
    if (!title)
      setTitle(
        issueTitle.toUpperCase().startsWith(`${identifier.toUpperCase()}:`)
          ? issueTitle
          : `${identifier}: ${issueTitle}`,
      );
    if (!targetBranch && defaultBranch) setTargetBranch(defaultBranch);
  }, [defaultBranch, identifier, issueTitle, open, targetBranch, title]);

  async function submit() {
    if (repositoryId === null) return;
    const magicWord = relation === 'closes' ? 'Fixes' : 'Refs';
    const description = [notes.trim(), `${magicWord} ${identifier}`].filter(Boolean).join('\n\n');
    try {
      await create.mutateAsync({
        repositoryId,
        sourceBranch,
        targetBranch,
        title: title.trim(),
        description,
        draft,
      });
      toast.success(t('createdSuccess'));
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('createFailed'));
    }
  }

  const valid =
    repositoryId !== null &&
    sourceBranch.length > 0 &&
    targetBranch.length > 0 &&
    sourceBranch !== targetBranch &&
    title.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('createPullRequest')}</DialogTitle>
          <DialogDescription>{t('createPullRequestDescription')}</DialogDescription>
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
          <div className="space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">{t('repository')}</span>
              <Select
                value={repositoryId === null ? undefined : String(repositoryId)}
                onValueChange={(value) => {
                  setRepositoryId(Number(value));
                  setSourceBranch('');
                  setTargetBranch('');
                }}
              >
                <SelectTrigger className="w-full rounded-md">
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
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">{t('sourceBranch')}</span>
                <Select value={sourceBranch || undefined} onValueChange={setSourceBranch}>
                  <SelectTrigger className="w-full rounded-md">
                    <SelectValue placeholder={t('chooseBranch')} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches
                      .filter((branch) => branch !== targetBranch)
                      .map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">{t('targetBranch')}</span>
                <Select value={targetBranch || undefined} onValueChange={setTargetBranch}>
                  <SelectTrigger className="w-full rounded-md">
                    <SelectValue placeholder={t('chooseBranch')} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches
                      .filter((branch) => branch !== sourceBranch)
                      .map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
            {branchesQuery.isPending && (
              <p className="text-sm text-muted-foreground">{t('loadingBranches')}</p>
            )}
            {branchesQuery.hasNextPage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                disabled={branchesQuery.isFetchingNextPage}
                onClick={() => void branchesQuery.fetchNextPage()}
              >
                {t('loadMoreBranches')}
              </Button>
            )}
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">{t('pullRequestTitle')}</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">{t('description')}</span>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t('descriptionPlaceholder')}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">{t('mergeBehavior')}</span>
                <Select
                  value={relation}
                  onValueChange={(value) => setRelation(value as typeof relation)}
                >
                  <SelectTrigger className="w-full rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="closes">{t('closeOnMerge')}</SelectItem>
                    <SelectItem value="references">{t('referenceOnly')}</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="flex items-center gap-2 self-end rounded-md border px-3 py-2 text-sm">
                <Checkbox checked={draft} onCheckedChange={(value) => setDraft(value === true)} />
                <span>{t('createAsDraft')}</span>
              </label>
            </div>
            {sourceBranch && targetBranch && sourceBranch === targetBranch && (
              <p className="text-sm text-destructive">{t('branchesMustDiffer')}</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button type="button" disabled={!valid || create.isPending} onClick={() => void submit()}>
            {create.isPending ? t('creating') : t('createPullRequest')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
