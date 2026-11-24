import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GitProviderConnection } from '@/lib/api/endpoints/git';
import { teamSectionPath } from '@/utils/paths';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Picks the provider account to connect repositories through. Accounts are added in
// the team settings, by a team owner or manager.
export default function GitConnectRepositoryButton({
  connections,
  teamRef,
  canManageTeam,
  onPick,
}: {
  connections: GitProviderConnection[];
  teamRef: string;
  canManageTeam: boolean;
  onPick: (connection: GitProviderConnection) => void;
}) {
  const t = useTranslations('settings.git');
  const accountsPath = teamSectionPath(teamRef, 'git');

  if (connections.length === 0)
    return canManageTeam ? (
      <Button asChild variant="outline" size="sm">
        <Link href={accountsPath}>
          <Plus className="size-3.5" />
          {t('addProviderAccount')}
        </Link>
      </Button>
    ) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-3.5" />
          {t('connectRepository')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {connections.map((connection) => (
          <DropdownMenuItem key={connection.id} onClick={() => onPick(connection)}>
            {GIT_PROVIDER_CONFIG[connection.provider].label} · {connection.accountLogin}
          </DropdownMenuItem>
        ))}
        {canManageTeam && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={accountsPath}>{t('addProviderAccount')}</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
