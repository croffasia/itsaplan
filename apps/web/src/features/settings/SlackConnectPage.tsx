'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import BrandCardPage from '@/components/common/page/BrandCardPage';
import { Button } from '@/components/ui/button';
import { notificationsPath } from '@/utils/paths';
import { useCompleteSlackLink } from './services/slack.service';

// Where Slack sends a member back after Sign in with Slack (/slack/connect). It hands the
// code to the api and returns the member to the notification settings they started from.
export default function SlackConnectPage() {
  const t = useTranslations('settings.notifications');
  const router = useRouter();
  const params = useSearchParams();
  const complete = useCompleteSlackLink();
  const code = params.get('code');
  const state = params.get('state');
  // The code is good for one exchange, and a dev render runs the effect twice.
  const sent = useRef(false);
  useDocumentTitle(t('slackAccount'));

  useEffect(() => {
    if (!code || !state || sent.current) return;
    sent.current = true;
    complete.mutate(
      { code, state },
      {
        onSuccess: ({ projectRef }) => {
          toast.success(t('slackConnectedToast'));
          router.replace(notificationsPath(projectRef));
        },
      },
    );
  }, [code, state, complete, router, t]);

  // Slack sends no code when the member cancels on its consent screen.
  const cancelled = !code || !state;
  const failed = cancelled || complete.isError;
  const message = cancelled ? t('slackConnectCancelled') : complete.error?.message;

  return (
    <BrandCardPage>
      <div className="flex flex-col items-center gap-4 p-6 text-center md:p-8">
        <h1 className="text-2xl font-bold">
          {failed ? t('slackConnectFailed') : t('slackConnecting')}
        </h1>
        {failed && (
          <>
            <p className="text-sm text-balance text-muted-foreground">{message}</p>
            <Button asChild variant="outline">
              <Link href="/">{t('slackBack')}</Link>
            </Button>
          </>
        )}
      </div>
    </BrandCardPage>
  );
}
