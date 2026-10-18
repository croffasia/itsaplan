import { getTranslations } from 'next-intl/server';
import OrbitMark from '@/components/brand/system/OrbitMark';

export default async function Loading() {
  const t = await getTranslations('common');
  return (
    <div role="status" className="flex flex-1 items-center justify-center py-16">
      <OrbitMark fast className="w-24" />
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}
