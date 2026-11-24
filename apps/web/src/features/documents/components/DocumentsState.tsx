import { CloudOff, LockKeyhole, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import DocumentTopBar from './DocumentTopBar';
import DocumentsCrumbs from './DocumentsCrumbs';

// What the Docs screen shows when the viewer cannot read Docs, or the page list did not load.
export default function DocumentsState({
  projectKey,
  kind,
  onRetry,
}: {
  projectKey: string;
  kind: 'noAccess' | 'failed';
  onRetry?: () => void;
}) {
  const t = useTranslations('documents');
  const noAccess = kind === 'noAccess';
  const Icon = noAccess ? LockKeyhole : CloudOff;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <DocumentTopBar>
        <DocumentsCrumbs projectKey={projectKey} />
      </DocumentTopBar>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="slide-in-from-bottom-1.5 flex max-w-140 animate-in flex-col items-start gap-2 px-[clamp(1rem,3vw,2.5rem)] py-18 fade-in-0">
          <span className="mb-2 grid size-9 place-items-center rounded-lg bg-muted">
            <Icon className="size-4" />
          </span>
          <h2 className="text-xl font-semibold tracking-[-0.015em]">
            {noAccess ? t('noAccessTitle') : t('loadFailed')}
          </h2>
          <p className="mb-3 text-[15px] text-muted-foreground">
            {noAccess ? t('noAccess') : t('loadFailedHint')}
          </p>
          {!noAccess && onRetry && (
            <Button variant="ghost" size="sm" onClick={onRetry}>
              <RefreshCw />
              {t('reload')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
