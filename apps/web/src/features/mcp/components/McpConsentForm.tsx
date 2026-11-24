'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleAlert, LoaderCircle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import type { ConsentRedirect } from '../utils/consentRequest';
import McpConsentDetails from './McpConsentDetails';
import McpConsentLogos from './McpConsentLogos';
import McpConsentPermissions from './McpConsentPermissions';

type Answer = 'allow' | 'deny';

export default function McpConsentForm({
  clientName,
  redirect,
}: {
  clientName: string | null;
  redirect: ConsentRedirect | null;
}) {
  const t = useTranslations('mcp.oauth.consent');
  const [sending, setSending] = useState<Answer | null>(null);
  const [failure, setFailure] = useState<'expired' | 'failed' | null>(null);

  async function answer(choice: Answer) {
    if (sending) return;
    setSending(choice);
    setFailure(null);
    let expired = false;
    try {
      // The auth client adds the signed request from the URL and follows the redirect
      // to the MCP client the answer comes with.
      const { error } = await authClient.$fetch('/oauth2/consent', {
        method: 'POST',
        body: { accept: choice === 'allow' },
      });
      if (!error) return;
      // better-auth refuses a signed request past its codeExpiresIn this way.
      expired = (error as { error?: string }).error === 'invalid_signature';
    } catch {
      // A network failure: the same retry as a refused answer.
    }
    setFailure(expired ? 'expired' : 'failed');
    setSending(null);
  }

  return (
    <>
      <McpConsentLogos clientName={clientName} />
      <h1 className="text-center text-2xl font-bold text-balance">
        {clientName ? t('title', { client: clientName }) : t('titleUnnamed')}
      </h1>
      <McpConsentPermissions />
      <McpConsentDetails redirect={redirect} />
      <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        {clientName ? t('named', { client: clientName }) : t('unnamed')}
      </p>
      {failure ? (
        <p role="alert" className="flex items-start gap-2.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {t(failure)}
        </p>
      ) : null}
      {failure === 'expired' ? null : (
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="lg"
            disabled={sending !== null}
            onClick={() => answer('deny')}
          >
            {sending === 'deny' ? <LoaderCircle className="animate-spin" /> : null}
            {sending === 'deny' ? t('denying') : t('deny')}
          </Button>
          <Button size="lg" disabled={sending !== null} onClick={() => answer('allow')}>
            {sending === 'allow' ? <LoaderCircle className="animate-spin" /> : null}
            {sending === 'allow' ? t('allowing') : t('allow')}
          </Button>
        </div>
      )}
    </>
  );
}
