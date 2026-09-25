import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { teamSectionPath } from '@/utils/paths';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';
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
  const tc = useTranslations('common');
  const connections = useGitProviderConnectionsQuery(projectKey);
  const empty = !connections.isPending && connections.data?.length === 0;
  const addButton = canManageTeam && (
    <Button asChild variant="ghost" size="sm">
      <Link href={teamSectionPath(teamId, 'git')}>
        <Plus className="size-3.5" />
        {tc('add')}
      </Link>
    </Button>
  );

  return (
    <SettingsSection title={t('nativeConnectionsRecommended')} action={!empty && addButton}>
      <div className="space-y-3">
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
        {empty && (
          <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            <p>{t('nativeNoConnections')}</p>
            {addButton || <p>{t('nativeAskTeamManager')}</p>}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
