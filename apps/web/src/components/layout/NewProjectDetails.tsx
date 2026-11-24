import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// The second step: what the project starts from, with a way back to change it, above the
// project fields.
export default function NewProjectDetails({
  start,
  onChange,
  children,
}: {
  start: string;
  onChange: () => void;
  children: ReactNode;
}) {
  const t = useTranslations('newProject');
  const tCommon = useTranslations('common');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{t('startFrom')}</p>
          <p className="truncate text-sm font-medium" dir="auto">
            {start}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onChange}>
          {tCommon('change')}
        </Button>
      </div>
      {children}
    </div>
  );
}
