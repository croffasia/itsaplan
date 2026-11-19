import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import DocumentTitle from '@/components/common/DocumentTitle';
import BrandCardPage from '@/components/common/page/BrandCardPage';
import AuthLegalNotice from './AuthLegalNotice';

// The card shared by every logged-out screen. The forms read the URL (an invite
// parameter, a reset token, a "just confirmed" flag), so they render inside a
// Suspense boundary — useSearchParams needs one for these pages to prerender.
export default function AuthCard({
  screen,
  children,
}: {
  screen: 'signIn' | 'signUp' | 'forgotPassword' | 'resetPassword';
  children: ReactNode;
}) {
  const t = useTranslations('meta.screens');
  return (
    <BrandCardPage
      footer={
        <>
          <AuthLegalNotice />
          <DocumentTitle title={t(screen)} />
        </>
      }
    >
      <Suspense fallback={null}>{children}</Suspense>
    </BrandCardPage>
  );
}
