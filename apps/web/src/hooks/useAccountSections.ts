import { useAuthConfig } from '@/services/authConfig.service';
import { ACCOUNT_SECTIONS, type AccountSection } from '@/utils/accountSections';

// The account pages to offer. Accounts holds only Google, so it is left out while the
// instance does not sign in with it.
export function useAccountSections(): AccountSection[] {
  const google = useAuthConfig()?.google ?? false;
  return google ? ACCOUNT_SECTIONS : ACCOUNT_SECTIONS.filter((s) => s.slug !== 'accounts');
}
