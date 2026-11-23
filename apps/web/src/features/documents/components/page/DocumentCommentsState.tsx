import { MessageSquareDashed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// What the comments panel shows in place of threads: the list loading, a failed load
// with a retry, or `message` when the tab has none.
export default function DocumentCommentsState({
  kind,
  message,
  onRetry,
}: {
  kind: 'loading' | 'failed' | 'empty';
  message?: string;
  onRetry?: () => void;
}) {
  const t = useTranslations('documents.comments');

  if (kind === 'loading') {
    return (
      <p className="px-4 py-12 text-center text-[13px] text-muted-foreground">{t('loading')}</p>
    );
  }
  return (
    <div className="px-4 py-12 text-center text-[13px] text-muted-foreground">
      {kind === 'failed' ? (
        <>
          <p>{t('loadFailed')}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={onRetry}>
            {t('retry')}
          </Button>
        </>
      ) : (
        <>
          <MessageSquareDashed className="mx-auto mb-2 size-5" />
          <p className="mx-auto max-w-[26ch]">{message}</p>
        </>
      )}
    </div>
  );
}
