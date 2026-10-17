'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { authClient, useSession } from '@/lib/auth-client';
import { useOAuthClientNameQuery } from '../services/oauthClients.service';
import { consentRequest } from '../utils/consentRequest';

export default function OAuthConsentPage() {
  const t = useTranslations('mcp');
  const searchParams = useSearchParams();
  // The signed authorization request the server sent the person here with.
  const signed = searchParams.has('sig');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { clientId, redirectHost } = consentRequest(searchParams);
  const { data: session } = useSession();
  const { data: clientName } = useOAuthClientNameQuery(clientId);

  async function decide(accept: boolean) {
    if (!signed || pending) return;
    setPending(true);
    setError(null);
    try {
      // The auth client adds the signed request from the URL and follows the redirect
      // to the MCP client the answer comes with.
      const { error } = await authClient.$fetch('/oauth2/consent', {
        method: 'POST',
        body: { accept },
      });
      if (error) throw new Error(error.message || t('oauth.consent.failed'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('oauth.consent.failed'));
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md space-y-5 rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">
            {clientName
              ? t('oauth.consent.title', { client: clientName })
              : t('oauth.consent.titleUnnamed')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('oauth.consent.description')}</p>
          {session?.user.email ? (
            <p className="text-sm text-muted-foreground">
              {t('oauth.consent.account', { email: session.user.email })}
            </p>
          ) : null}
          {redirectHost ? (
            <p className="text-sm text-muted-foreground">
              {t('oauth.consent.redirect', { host: redirectHost })}
            </p>
          ) : null}
        </div>
        {!signed ? (
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
