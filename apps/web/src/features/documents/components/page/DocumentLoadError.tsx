import Link from 'next/link';
import { ArrowLeft, CloudOff, FileX2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { documentsPath } from '@/utils/paths';

// A page that failed to load, or one that no longer exists for this user.
export default function DocumentLoadError({
  projectKey,
  notFound,
  onRetry,
}: {
  projectKey: string;
  notFound: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations('documents');
  const Icon = notFound ? FileX2 : CloudOff;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex max-w-140 flex-col items-start gap-2 px-[clamp(16px,3vw,40px)] py-18">
        <span className="mb-2 grid size-9 place-items-center rounded-lg bg-muted">
          <Icon className="size-4" aria-hidden />
        </span>
        <h2 className="text-xl font-semibold tracking-[-0.015em]">
          {notFound ? t('pageUnavailable') : t('pageLoadFailed')}
        </h2>
        <p className="mb-3 text-[15px] text-muted-foreground">
          {notFound ? t('pageNotFound') : t('checkConnection')}
        </p>
        {notFound ? (
          <Button variant="ghost" asChild>
            <Link href={documentsPath(projectKey)}>
              <ArrowLeft className="rtl:rotate-180" />
              {t('backToDocuments')}
            </Link>
          </Button>
        ) : (
          <Button variant="ghost" onClick={onRetry}>
            <RefreshCw />
            {t('reload')}
          </Button>
        )}
      </div>
    </div>
  );
}
