'use client';

import { useState } from 'react';
import { GitBranch, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { GitConnectionProvider } from '@/lib/api/endpoints/git';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';
import {
  useDisconnectGitProvider,
  useTeamGitProviderConnectionsQuery,
} from '@/services/gitConnections.service';
import { GIT_CONNECTION_PROVIDERS, GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';
import TeamGitProviderConnectDialog from './TeamGitProviderConnectDialog';

export default function TeamGitConnections({ teamId }: { teamId: number }) {
  const t = useTranslations('settings.git');
  const connections = useTeamGitProviderConnectionsQuery(teamId);
  const disconnect = useDisconnectGitProvider(teamId);
  const [provider, setProvider] = useState<GitConnectionProvider>('gitlab');
  const [dialogOpen, setDialogOpen] = useState(false);

  async function remove(connectionId: number, label: string) {
    if (!window.confirm(t('nativeDisconnectConfirm', { provider: label }))) return;
    try {
      await disconnect.mutateAsync(connectionId);
      toast.success(t('nativeDisconnected', { provider: label }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('nativeDisconnectFailed'));
    }
  }

  return (
    <SettingsSection title={t('nativeConnectionsRecommended')}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {GIT_CONNECTION_PROVIDERS.map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              onClick={() => {
                setProvider(key);
                setDialogOpen(true);
              }}
            >
              <GitBranch className="size-4" />
              {t('nativeConnectProvider', { provider: GIT_PROVIDER_CONFIG[key].label })}
            </Button>
          ))}
        </div>
        {connections.isPending ? (
          <ListSkeleton rows={2} rowClassName="h-16" />
        ) : (
          connections.data?.map((connection) => (
            <div
              key={connection.id}
              className="flex items-center justify-between gap-4 rounded-md border p-4"
            >
              <div className="min-w-0">
                <p className="font-medium">{GIT_PROVIDER_CONFIG[connection.provider].label}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {connection.accountLogin} · {connection.baseUrl}
                </p>
                {connection.repositories
                  .filter((repository) => repository.lastError)
                  .map((repository) => (
                    <p key={repository.id} className="text-xs text-destructive">
                      {repository.fullName}: {repository.lastError}
                    </p>
                  ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('nativeDisconnectProvider')}
                disabled={disconnect.isPending}
                onClick={() =>
                  void remove(connection.id, GIT_PROVIDER_CONFIG[connection.provider].label)
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>
      <TeamGitProviderConnectDialog
        teamId={teamId}
        provider={provider}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </SettingsSection>
  );
}
