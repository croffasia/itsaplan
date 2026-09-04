import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

export default function DocumentLoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('documents');

  return (
    <main className="flex min-w-0 flex-1 items-center justify-center px-6 text-center">
      <div>
        <p className="text-sm text-muted-foreground">{t('loadFailed')}</p>
        <Button className="mt-3" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw />
          {t('reload')}
        </Button>
      </div>
    </main>
  );
}
