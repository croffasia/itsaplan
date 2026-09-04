import { useState } from 'react';
import { GitBranch } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GitConnectionProvider } from '@/lib/api';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';
import { useGitProviderConnectionsQuery } from '../../services/settings.service';
import GitProviderConnectDialog from './GitProviderConnectDialog';
import GitProviderConnectionCard from './GitProviderConnectionCard';
import { GIT_CONNECTION_PROVIDERS, GIT_PROVIDER_CONFIG } from './providerConfig';

export default function GitProviderConnections({
  projectKey,
  editable,
}: {
  projectKey: string;
  editable: boolean;
}) {
  const t = useTranslations('settings.git');
  const connections = useGitProviderConnectionsQuery(projectKey);
  const [provider, setProvider] = useState<GitConnectionProvider>('gitlab');
  const [dialogOpen, setDialogOpen] = useState(false);

  function open(providerToConnect: GitConnectionProvider) {
    setProvider(providerToConnect);
    setDialogOpen(true);
  }

  return (
    <SettingsSection
      title={t('nativeConnectionsRecommended')}
      description={t('nativeConnectionsHint')}
    >
      <div className="space-y-3">
        {editable && (
          <div className="flex flex-wrap gap-2">
            {GIT_CONNECTION_PROVIDERS.map((providerKey) => (
              <Button
                key={providerKey}
                type="button"
                variant="outline"
                onClick={() => open(providerKey)}
              >
                <GitBranch className="size-4" />
                {t('nativeConnectProvider', {
                  provider: GIT_PROVIDER_CONFIG[providerKey].label,
                })}
              </Button>
            ))}
          </div>
        )}
        {connections.isPending ? (
          <ListSkeleton rows={2} rowClassName="h-24" />
        ) : (
          connections.data?.map((connection) => (
            <GitProviderConnectionCard
              key={connection.id}
              projectKey={projectKey}
              connection={connection}
              editable={editable}
            />
          ))
        )}
        {!connections.isPending && connections.data?.length === 0 && (
          <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            {t('nativeNoConnections')}
          </p>
        )}
      </div>
      <GitProviderConnectDialog
        projectKey={projectKey}
        provider={provider}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </SettingsSection>
  );
}
