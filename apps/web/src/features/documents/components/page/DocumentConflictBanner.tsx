import { History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import DocumentBanner, { BANNER_BUTTON } from './DocumentBanner';

export default function DocumentConflictBanner({ onReview }: { onReview: () => void }) {
  const t = useTranslations('documents');

  return (
    <DocumentBanner
      icon={History}
      tone="warn"
      actions={
        <Button variant="ghost" size="sm" className={BANNER_BUTTON} onClick={onReview}>
          {t('reviewConflict')}
        </Button>
      }
    >
      {t('conflictBanner')}
    </DocumentBanner>
  );
}
