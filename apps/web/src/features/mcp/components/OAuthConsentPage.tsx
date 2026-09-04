'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { API_URL } from '@/lib/api';

type ConsentResponse = { redirectURI?: string; message?: string };

export default function OAuthConsentPage() {
  const t = useTranslations('mcp');
  const searchParams = useSearchParams();
  const consentCode = searchParams.get('consent_code');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function decide(accept: boolean) {
    if (!consentCode || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/auth/oauth2/consent`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accept, consent_code: consentCode }),
      });
      const result = (await response.json()) as ConsentResponse;
      if (!response.ok || !result.redirectURI)
        throw new Error(result.message || t('oauth.consent.failed'));
      window.location.assign(result.redirectURI);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('oauth.consent.failed'));
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md space-y-5 rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{t('oauth.consent.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('oauth.consent.description')}</p>
        </div>
        {!consentCode ? (
          <p className="text-sm text-destructive">{t('oauth.consent.missingCode')}</p>
        ) : (
          <div className="flex justify-end gap-3">
            <button
              className="rounded-md border px-4 py-2 text-sm"
              disabled={pending}
              onClick={() => decide(false)}
            >
              {t('oauth.consent.cancel')}
            </button>
            <button
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              disabled={pending}
              onClick={() => decide(true)}
            >
              {pending ? t('oauth.consent.pending') : t('oauth.consent.authorize')}
            </button>
          </div>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </section>
    </main>
  );
}
