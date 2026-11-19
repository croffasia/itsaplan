'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BrandCardPage from '@/components/common/page/BrandCardPage';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import McpConsentForm from './components/McpConsentForm';
import McpConsentIncomplete from './components/McpConsentIncomplete';
import { useOAuthClientNameQuery } from './services/oauthClients.service';
import { consentRequest } from './utils/consentRequest';

// The screen better-auth sends a person to when an MCP client asks for their account.
export default function McpOAuthConsentPage() {
  const t = useTranslations('mcp.oauth.consent');
  const tScreens = useTranslations('meta.screens');
  useDocumentTitle(tScreens('allowAccess'));
  const searchParams = useSearchParams();
  const { clientId, redirect } = consentRequest(searchParams);
  const nameQuery = useOAuthClientNameQuery(clientId);

  let body = <McpConsentIncomplete />;
  if (searchParams.has('sig')) {
    // A disabled query (no client_id) stays pending, so it is not waited for.
    body =
      clientId !== null && nameQuery.isPending ? (
        <ListSkeleton rows={4} rowClassName="h-12" />
      ) : (
        <McpConsentForm clientName={nameQuery.data ?? null} redirect={redirect} />
      );
  }

  return (
    <BrandCardPage subtitle={t('brandSubtitle')}>
      <section className="flex flex-col gap-6 p-6 md:p-8">{body}</section>
    </BrandCardPage>
  );
}
