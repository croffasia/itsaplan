import { ExternalLink, GitBranch, Settings2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { GitManagedRepository, GitProviderConnection } from '@/lib/api/endpoints/git';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDisconnectGitRepository } from '../../services/settings.service';

// A repository connected through a provider account: Plan manages its webhook and
// can sync its issues.
export default function GitManagedRepositoryRow({
  projectKey,
  connection,
  repository,
  onOpenSettings,
}: {
  projectKey: string;
  connection: GitProviderConnection;
  repository: GitManagedRepository;
  onOpenSettings: () => void;
}) {
  const t = useTranslations('settings.git');
  const disconnect = useDisconnectGitRepository(projectKey, connection.id);
  const syncsIssues = connection.provider !== 'bitbucket';

  async function remove() {
    await disconnect.mutateAsync(repository.id);
    toast.success(t('nativeRepositoryDisconnected'));
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <GitBranch className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <a
          href={repository.webUrl}
          target="_blank"
          rel="noreferrer"
          dir="ltr"
          className="block truncate text-sm font-medium hover:underline"
        >
          {repository.fullName}
          <ExternalLink className="ms-1 inline size-3" />
        </a>
        <p className="truncate text-xs text-muted-foreground">
          {t('managedRepositoryMeta', {
            provider: GIT_PROVIDER_CONFIG[connection.provider].label,
            account: connection.accountLogin,
          })}
        </p>
        {repository.lastError && (
          <p className="mt-0.5 truncate text-xs text-destructive" title={repository.lastError}>
            {repository.lastError}
          </p>
        )}
      </div>
      {repository.issueSync !== 'off' && (
        <Badge variant="outline">{t(`issueSyncBadge.${repository.issueSync}`)}</Badge>
      )}
      <Badge variant={repository.status === 'connected' ? 'secondary' : 'destructive'}>
        {repository.status === 'connected' ? t('nativeWebhookActive') : t('nativeWebhookError')}
      </Badge>
      {syncsIssues && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('repositorySettings')}
          onClick={onOpenSettings}
        >
          <Settings2 className="size-4" />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t('nativeDisconnectRepository')}
        disabled={disconnect.isPending}
        onClick={() => void remove()}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
