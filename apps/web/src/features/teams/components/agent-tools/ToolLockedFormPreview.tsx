import { useTranslations } from 'next-intl';
import { SECTION_PREVIEW_CONTENT_CLASS } from '@/components/common/page/SectionPreview';
import { cn } from '@/lib/utils';

const PARAMS = ['title', 'tags'];

// The HTTP tool form of Cloud and Pro, filled in with an example. It only illustrates the text
// under it, so screen readers skip it.
export default function ToolLockedFormPreview() {
  const t = useTranslations('teams.tools.ownToolPreview');
  return (
    <div
      aria-hidden
      className={cn(
        SECTION_PREVIEW_CONTENT_CLASS,
        'border-b bg-sidebar bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] px-6 pt-5',
      )}
    >
      <div className="rounded-t-lg border border-b-0 bg-card mask-b-from-55% shadow-sm">
        <p className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold">{t('heading')}</p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5 p-3 pb-6 text-xs">
          <dt className="text-muted-foreground">{t('title')}</dt>
          <dd className="truncate">{t('titleValue')}</dd>
          <dt className="text-muted-foreground">{t('connection')}</dt>
          <dd className="truncate">{t('connectionValue')}</dd>
          <dt className="text-muted-foreground">{t('path')}</dt>
          <dd>
            <span dir="ltr" className="inline-flex items-center gap-1.5 font-mono">
              <span className="rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                POST
              </span>
              /posts
            </span>
          </dd>
          <dt className="text-muted-foreground">{t('params')}</dt>
          <dd>
            <span dir="ltr" className="inline-flex gap-1 font-mono">
              {PARAMS.map((param) => (
                <span key={param} className="rounded bg-muted px-1.5">
                  {param}
                </span>
              ))}
            </span>
          </dd>
        </dl>
      </div>
    </div>
  );
}
