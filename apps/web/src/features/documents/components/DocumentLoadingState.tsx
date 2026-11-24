import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

const LINES = ['96%', '88%', '92%', '64%', null, '90%', '76%'];

// The shape of a page while it loads: icon, title, properties and a few lines of text.
export default function DocumentLoadingState() {
  const t = useTranslations('documents');

  return (
    <div className="min-h-0 flex-1 overflow-hidden px-[clamp(16px,3vw,40px)] pt-10">
      <div aria-busy="true" aria-label={t('loadingPage')}>
        <div className="mb-4 flex items-center gap-3">
          <Skeleton className="size-11 rounded-lg" />
          <Skeleton className="h-10 w-[min(420px,60%)]" />
        </div>
        <div className="mb-10 flex gap-1.5">
          {[110, 90, 140].map((width) => (
            <Skeleton key={width} className="h-7 rounded-full" style={{ width }} />
          ))}
        </div>
        {LINES.map((width, index) =>
          width ? (
            <Skeleton key={index} className="mb-3.5 h-3.5" style={{ width }} />
          ) : (
            <div key={index} className="h-6" />
          ),
        )}
      </div>
    </div>
  );
}
