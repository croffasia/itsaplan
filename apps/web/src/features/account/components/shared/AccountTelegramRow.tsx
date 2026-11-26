'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  telegramOffered,
  useDisconnectTelegram,
  useTelegramAccountLabel,
  useTelegramAccountQuery,
} from '../../services/telegram.service';
import AccountConnectButton from './AccountConnectButton';
import AccountServiceRow from './AccountServiceRow';
import AccountTelegramConnectDialog from './AccountTelegramConnectDialog';

export default function AccountTelegramRow({ icon }: { icon: ReactNode }) {
  const t = useTranslations('account.notifications');
  const tAccounts = useTranslations('account.accounts');
  const accountLabel = useTelegramAccountLabel();
  const { data } = useTelegramAccountQuery();
  const disconnect = useDisconnectTelegram();
  const [connecting, setConnecting] = useState(false);

  if (data && !telegramOffered(data)) return null;
  const link = data?.link ?? null;

  return (
    <AccountServiceRow
      icon={icon}
      name={t('telegram')}
      info={link ? accountLabel(link) : t('notConnected')}
    >
      <AccountConnectButton
        service={t('telegram')}
        connected={link !== null}
        busy={disconnect.isPending}
        disconnectWarning={tAccounts('telegramDisconnectWarning')}
        onConnect={() => setConnecting(true)}
        onDisconnect={async () => {
          await disconnect.mutateAsync();
          toast.success(t('telegramDisconnected'));
        }}
      />
      <AccountTelegramConnectDialog open={connecting} onOpenChange={setConnecting} />
    </AccountServiceRow>
  );
}
