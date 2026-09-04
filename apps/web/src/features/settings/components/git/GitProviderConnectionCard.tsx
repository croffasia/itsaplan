import { useState } from 'react';
import { ExternalLink, GitBranch, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { GitProviderConnection } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SettingsCard from '@/components/common/page/SettingsCard';
import {
  useDisconnectGitProvider,
  useDisconnectGitRepository,
} from '../../services/settings.service';
import GitRepositoryPickerDialog from './GitRepositoryPickerDialog';
import { GIT_PROVIDER_CONFIG } from './providerConfig';

export default function GitProviderConnectionCard({
  projectKey,
  connection,
  editable,
}: {
  projectKey: string;
  connection: GitProviderConnection;
  editable: boolean;
}) {
  const t = useTranslations('settings.git');
  const [pickerOpen, setPickerOpen] = useState(false);
  const disconnectProvider = useDisconnectGitProvider(projectKey);
  const disconnectRepository = useDisconnectGitRepository(projectKey, connection.id);
  const providerLabel = GIT_PROVIDER_CONFIG[connection.provider].label;

  async function removeRepository(repositoryId: number) {
    try {
      await disconnectRepository.mutateAsync(repositoryId);
      toast.success(t('nativeRepositoryDisconnected'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('nativeDisconnectFailed'));
    }
  }

  async function removeProvider() {
    if (!window.confirm(t('nativeDisconnectConfirm', { provider: providerLabel }))) return;
    try {
      await disconnectProvider.mutateAsync(connection.id);
      toast.success(t('nativeDisconnected', { provider: providerLabel }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('nativeDisconnectFailed'));
    }
  }

  return (
    <>
      <SettingsCard>
        <div className="flex flex-wrap items-start justify-between gap-4 p-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{providerLabel}</span>
              <Badge variant="secondary">{t('nativeConnectedStatus')}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {connection.accountLogin} · {connection.baseUrl}
            </p>
          </div>
          {editable && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                {t('nativeChooseRepositories')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('nativeDisconnectProvider')}
                disabled={disconnectProvider.isPending}
                onClick={() => void removeProvider()}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="divide-y border-t">
          {connection.repositories.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {t('nativeNoConnectedRepositories')}
            </p>
          ) : (
            connection.repositories.map((repository) => (
              <div key={repository.id} className="flex items-center gap-3 px-4 py-3">
                <GitBranch className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <a
                    href={repository.webUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {repository.fullName}
                    <ExternalLink className="ms-1 inline size-3" />
                  </a>
                  {repository.lastError && (
                    <p
                      className="mt-0.5 truncate text-xs text-destructive"
                      title={repository.lastError}
                    >
                      {repository.lastError}
                    </p>
                  )}
                </div>
                <Badge variant={repository.status === 'connected' ? 'secondary' : 'destructive'}>
                  {repository.status === 'connected'
                    ? t('nativeWebhookActive')
                    : t('nativeWebhookError')}
                </Badge>
                {editable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('nativeDisconnectRepository')}
                    disabled={disconnectRepository.isPending}
                    onClick={() => void removeRepository(repository.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </SettingsCard>
      <GitRepositoryPickerDialog
        projectKey={projectKey}
        connection={connection}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </>
  );
}
