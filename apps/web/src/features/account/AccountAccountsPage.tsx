'use client';

import FullPageView from '@/components/common/page/FullPageView';
import AccountGoogleConnection from './components/accounts/AccountGoogleConnection';
import AccountTelegramConnection from './components/accounts/AccountTelegramConnection';
import { useGoogleAvailable } from './services/accounts.service';

// A provider is only listed when the instance has it configured, so the page never
// offers a connection that cannot complete. Telegram makes that check itself.
export default function AccountAccountsPage() {
  const googleAvailable = useGoogleAvailable();

  return (
    <FullPageView
      label="Accounts"
      title="Accounts"
      description="Connect external accounts to sign in with them or receive notifications there."
    >
      <div className="divide-y">
        {googleAvailable && <AccountGoogleConnection />}
        <AccountTelegramConnection />
      </div>
    </FullPageView>
  );
}
