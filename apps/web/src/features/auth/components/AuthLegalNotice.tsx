'use client';

import { useTranslations } from 'next-intl';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/utils/app';

const linkClass = 'underline underline-offset-4 hover:text-foreground';

// Sits under the card on every logged-out screen. Google requires the privacy policy
// and terms registered for the OAuth client to be reachable from where sign-in
// starts, so this stays visible next to the "Continue with Google" button. An
// instance that does not configure the URLs (apps/web/.env) renders nothing.
export default function AuthLegalNotice() {
  const t = useTranslations('auth.legal');

  if (!TERMS_URL && !PRIVACY_POLICY_URL) return null;

  const key = TERMS_URL && PRIVACY_POLICY_URL ? 'both' : TERMS_URL ? 'termsOnly' : 'privacyOnly';

  return (
    <p className="text-center text-xs text-muted-foreground">
      {t.rich(key, {
        terms: (chunks) => (
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {chunks}
          </a>
        ),
        privacy: (chunks) => (
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {chunks}
          </a>
        ),
      })}
    </p>
  );
}
