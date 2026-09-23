import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { teamSectionPath } from '@/utils/paths';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsSection from '@/components/common/page/SettingsSection';
import { useGitProviderConnectionsQuery } from '../../services/settings.service';
import GitProviderConnectionCard from './GitProviderConnectionCard';

export default function GitProviderConnections({
  projectKey,
  teamId,
  canManageTeam,
  editable,
}: {
  projectKey: string;
  teamId: number;
  canManageTeam: boolean;
  editable: boolean;
}) {
  const t = useTranslations('settings.git');
  const connections = useGitProviderConnectionsQuery(projectKey);

  return (
    <SettingsSection title={t('nativeConnectionsRecommended')}>
      <div className="space-y-3">
        {canManageTeam && (
          <Link
            className="text-sm text-primary hover:underline"
            href={teamSectionPath(teamId, 'git')}
          >
            Git
          </Link>
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
    </SettingsSection>
  );
}
