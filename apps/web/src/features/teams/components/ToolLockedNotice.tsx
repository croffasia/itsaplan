import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import UpgradeToProButton from '@/components/common/UpgradeToProButton';
import { cn } from '@/lib/utils';

// Shown on an integration that comes with another edition, in the add-tool and the
// credential dialogs: its tools are listed, and nothing of it can be added here.
export function ToolLockedNotice({
  integration,
  className,
}: {
  integration: string;
  className?: string;
}) {
  const t = useTranslations('teams.tools');
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5',
        className,
      )}
    >
      <Lock className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {t('lockedIntegration', { integration })}
        </p>
        <p className="text-xs text-muted-foreground">{t('lockedIntegrationHint')}</p>
      </div>
      <UpgradeToProButton feature="agent-tools" className="shrink-0" />
    </div>
  );
}
