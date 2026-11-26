import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { GitProviderConnection } from '@/lib/api/endpoints/git';
import GitAccountConnectDialog from '@/components/common/git/GitAccountConnectDialog';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Switch } from '@/components/ui/switch';
import { useGitAccountFor } from '@/services/gitAccounts.service';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';

// Whether comments written here go to the repository issue. Each one goes under its
// author's own account on the host, so the row says whether the viewer has one there and
// lets them connect it in place.
export default function GitCommentPushRow({
  connection,
  checked,
  onChange,
}: {
  connection: GitProviderConnection;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const t = useTranslations('settings.git');
  const account = useGitAccountFor(connection.baseUrl);
  const [connecting, setConnecting] = useState(false);
  const provider = GIT_PROVIDER_CONFIG[connection.provider].label;

  let description = t('issueCommentsPushHint');
  if (checked && account)
    description += ` ${t('issueCommentsPushAs', { login: account.accountLogin })}`;
  let note: ReactNode;
  if (checked && account === null)
    note = (
      <>
        {t('issueCommentsPushNotice', { provider })}{' '}
        <button
          type="button"
          className="font-medium underline underline-offset-2"
          onClick={() => setConnecting(true)}
        >
          {t('accountConnectAction', { provider })}
        </button>
      </>
    );

  return (
    <>
      <SettingsRow
        title={t('issueCommentsPush')}
        description={description}
        note={note}
        control={<Switch checked={checked} onCheckedChange={onChange} />}
      />
      {connection.provider !== 'bitbucket' && (
        <GitAccountConnectDialog
          open={connecting}
          onOpenChange={setConnecting}
          host={{ provider: connection.provider, baseUrl: connection.baseUrl }}
        />
      )}
    </>
  );
}
