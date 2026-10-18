import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import HomeArrow from '@/components/brand/system/HomeArrow';
import SystemScreen from '@/components/brand/system/SystemScreen';
import { Button } from '@/components/ui/button';

export default async function NotFound() {
  const t = await getTranslations('common.systemScreen');
  return (
    <SystemScreen code="404" title={t('notFoundTitle')} description={t('notFoundDescription')}>
      <Button asChild>
        <Link href="/">
          {t('home')}
          <HomeArrow />
        </Link>
      </Button>
    </SystemScreen>
  );
}
