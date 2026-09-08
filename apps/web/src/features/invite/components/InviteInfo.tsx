import type { ReactNode } from 'react';
import { FolderKanban, Mail, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InviteView } from '@/lib/api/endpoints/invites';
import { Badge } from '@/components/ui/badge';

function InfoRow({
  icon,
  label,
  value,
  badge,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
      {badge && (
        <Badge variant="outline" className="shrink-0 font-normal">
          {badge}
        </Badge>
      )}
    </div>
  );
}

// The invite summary shown at the top of the accept screen: which team, which
// project when it names one, for which email, as which role.
export default function InviteInfo({ invite }: { invite: InviteView }) {
  const t = useTranslations('invite');
  const tCommon = useTranslations('common');
  const tTeams = useTranslations('teams.manage');
  const projectRoleLabel =
    invite.role === 'owner' ? tCommon('owner') : (invite.roleName ?? tCommon('member'));
  return (
    <div className="divide-y rounded-lg border bg-muted/30 text-start">
      <InfoRow
        icon={<Users className="size-4" />}
        label={t('teamLabel')}
        value={invite.teamName}
        badge={tTeams(`roles.${invite.teamRole}`)}
      />
      {invite.projectName && (
        <InfoRow
          icon={<FolderKanban className="size-4" />}
          label={t('projectLabel')}
          value={invite.projectName}
          badge={projectRoleLabel}
        />
      )}
      <InfoRow icon={<Mail className="size-4" />} label={t('emailLabel')} value={invite.email} />
    </div>
  );
}
