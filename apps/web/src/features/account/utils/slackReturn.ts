import { accountPath } from '@/utils/accountSections';

// The account page a Slack connection started on. Slack sends the user back to
// /slack/connect in the same tab, so the tab's session storage carries it across.
const KEY = 'slack-connect-return';

export function rememberSlackReturn(): void {
  try {
    window.sessionStorage.setItem(KEY, window.location.pathname);
  } catch {
    // Storage unavailable (private mode): slackReturnPath falls back to the Accounts page.
  }
}

export function slackReturnPath(): string {
  try {
    const path = window.sessionStorage.getItem(KEY);
    if (path?.startsWith('/account/')) return path;
  } catch {
    // Storage unavailable (private mode): fall through to the Accounts page.
  }
  return accountPath('accounts');
}
