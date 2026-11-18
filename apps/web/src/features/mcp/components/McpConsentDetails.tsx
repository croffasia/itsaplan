import { Globe, Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Avatar from '@/components/common/Avatar';
import { useSession } from '@/lib/auth-client';
import type { ConsentRedirect } from '../utils/consentRequest';

// Which account the app gets, and where the answer goes: the one part of the request
// the app cannot name for itself.
export default function McpConsentDetails({ redirect }: { redirect: ConsentRedirect | null }) {
  const t = useTranslations('mcp.oauth.consent');
  const user = useSession().data?.user;
  const AppIcon = redirect?.local ? Monitor : Globe;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 text-sm">
      {user ? (
        <>
          <dt className="text-muted-foreground">{t('account')}</dt>
          <dd className="flex min-w-0 items-center gap-2.5">
            <Avatar name={user.name} image={user.image} className="size-7 text-[11px]" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-muted-foreground" dir="ltr">
                {user.email}
              </span>
            </span>
          </dd>
        </>
      ) : null}
      {redirect ? (
        <>
          <dt className="text-muted-foreground">{t('app')}</dt>
          <dd className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary">
              <AppIcon className="size-4 text-muted-foreground" />
            </span>
            <span className="flex min-w-0 flex-col">
              {redirect.local ? <span className="font-medium">{t('thisComputer')}</span> : null}
              <span
                className={
                  redirect.local
                    ? 'truncate font-mono text-xs text-muted-foreground'
                    : 'truncate font-medium'
                }
                dir="ltr"
              >
                {redirect.label}
              </span>
            </span>
          </dd>
        </>
      ) : null}
    </dl>
  );
}
