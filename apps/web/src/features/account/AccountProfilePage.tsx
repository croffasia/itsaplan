'use client';

import { useSession } from '@/lib/auth-client';
import FullPageView from '@/components/common/page/FullPageView';
import AccountProfileAvatar from './components/profile/AccountProfileAvatar';
import AccountProfileNameForm from './components/profile/AccountProfileNameForm';
import AccountSection from './components/AccountSection';

export default function AccountProfilePage() {
  const { data: session } = useSession();

  return (
    <FullPageView
      label="Profile"
      title="Profile"
      description={`Your name and avatar are shown across the app. Signed in as ${session?.user.email ?? '…'}.`}
    >
      <AccountSection
        title="Avatar"
        description="Shown next to your name in comments, assignees, and members."
      >
        <AccountProfileAvatar />
      </AccountSection>
      <AccountSection title="Name">
        <AccountProfileNameForm />
      </AccountSection>
    </FullPageView>
  );
}
