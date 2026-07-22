import { PRIVACY_POLICY_URL, TERMS_URL } from '@/utils/app';

const linkClass = 'underline underline-offset-4 hover:text-foreground';

// Sits under the card on every logged-out screen. Google requires the privacy policy
// and terms registered for the OAuth client to be reachable from where sign-in
// starts, so this stays visible next to the "Continue with Google" button. An
// instance that does not configure the URLs (apps/web/.env) renders nothing.
export default function AuthLegalNotice() {
  const terms = TERMS_URL ? (
    <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
      Terms of Service
    </a>
  ) : null;
  const privacy = PRIVACY_POLICY_URL ? (
    <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
      Privacy Policy
    </a>
  ) : null;

  if (!terms && !privacy) return null;

  return (
    <p className="text-center text-xs text-muted-foreground">
      By continuing you agree to our {terms}
      {terms && privacy ? ' and ' : null}
      {privacy}.
    </p>
  );
}
