'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import SystemScreen from '@/components/brand/system/SystemScreen';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations('common.systemScreen');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <SystemScreen title={t('errorTitle')} description={t('errorDescription')}>
      <Button onClick={() => retry()}>
        <RotateCw aria-hidden="true" />
        {t('retry')}
      </Button>
      <Button variant="outline" asChild>
        <Link href="/">{t('home')}</Link>
      </Button>
    </SystemScreen>
  );
}
