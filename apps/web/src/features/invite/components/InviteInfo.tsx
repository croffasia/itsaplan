import { useTranslations } from 'next-intl';
import { type InviteView } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

// The invite summary shown at the top of the accept screen: which project, for
// which email, as which role.
export default function InviteInfo({ invite }: { invite: InviteView }) {
  const t = useTranslations('invite');
  const tCommon = useTranslations('common');
  const roleLabel =
    invite.role === 'owner' ? tCommon('owner') : (invite.roleName ?? tCommon('member'));
  return (
    <div className="rounded-md border bg-muted/50 p-4 text-sm">
      <p className="text-muted-foreground">{t('invitedTo')}</p>
      <p className="mt-0.5 flex items-center gap-2 text-base font-semibold">
        {invite.projectName}
        <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
          {roleLabel}
        </Badge>
      </p>
      <p className="mt-2 text-muted-foreground">
        {t.rich('invitationFor', {
          email: invite.email,
          strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
        })}
      </p>
    </div>
  );
}
