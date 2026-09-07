import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

export default function DocumentConflictBanner({ onReload }: { onReload: () => void }) {
  const t = useTranslations('documents');

  return (
    <div
      className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-200"
      role="alert"
    >
      <span>{t('conflict')}</span>
      <Button type="button" variant="ghost" size="sm" onClick={onReload}>
        <RefreshCw />
        {t('reviewConflict')}
      </Button>
    </div>
  );
}
