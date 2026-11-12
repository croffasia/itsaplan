import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ImportStepState = 'done' | 'active' | 'pending';

// One step of an import, on a line of numbered steps: its form while it is open, what it
// settled once done, with a way back to it.
export default function SettingsImportExportStep({
  number,
  title,
  state,
  summary,
  onChange,
  last,
  children,
}: {
  number: number;
  title: string;
  state: ImportStepState;
  summary?: string;
  onChange: () => void;
  last: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('settings.importExport');
  return (
    <li className="flex gap-4" aria-current={state === 'active' ? 'step' : undefined}>
      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
            state === 'done' && 'bg-secondary text-foreground',
            state === 'active' && 'bg-primary text-primary-foreground',
            state === 'pending' && 'text-muted-foreground ring-1 ring-border ring-inset',
          )}
        >
          {state === 'done' ? <Check className="size-3.5" /> : number}
        </span>
        {!last && <span aria-hidden className="my-1.5 w-px flex-1 bg-border" />}
      </div>
      <div className={cn('min-w-0 flex-1', !last && 'pb-6')}>
        <div className="flex min-h-7 items-center gap-3">
          <h3
            className={cn(
              'shrink-0 text-sm font-medium',
              state === 'pending' && 'text-muted-foreground',
            )}
          >
            {title}
          </h3>
          {state === 'done' && summary && (
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground" dir="auto">
              {summary}
            </span>
          )}
          {state === 'done' && (
            <Button type="button" variant="ghost" size="sm" className="ms-auto" onClick={onChange}>
              {t('stepChange')}
            </Button>
          )}
        </div>
        {state === 'active' && <div className="mt-4">{children}</div>}
      </div>
    </li>
  );
}
