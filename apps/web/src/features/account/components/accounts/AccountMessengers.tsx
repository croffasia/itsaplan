'use client';

import { useTranslations } from 'next-intl';
import AccountListSection from '../shared/AccountListSection';
import AccountSlackRows from '../shared/AccountSlackRows';
import AccountTelegramRow from '../shared/AccountTelegramRow';
import AccountServiceMark from './AccountServiceMark';
import { useSlackAccountsQuery } from '../../services/slack.service';
import { telegramOffered, useTelegramAccountQuery } from '../../services/telegram.service';

// The user's Telegram and Slack accounts. The section is left out while the instance
// offers neither.
export default function AccountMessengers() {
  const t = useTranslations('account.accounts');
  const { data: telegram } = useTelegramAccountQuery();
  const { data: slack } = useSlackAccountsQuery();

  if (!(telegram && telegramOffered(telegram)) && !slack?.length) return null;

  return (
    <AccountListSection
      title={t('messengers')}
      description={t('messengersDescription')}
      help={t('messengersHelp')}
    >
      <AccountTelegramRow icon={<AccountServiceMark service="telegram" />} />
      <AccountSlackRows icon={<AccountServiceMark service="slack" />} />
    </AccountListSection>
  );
}
