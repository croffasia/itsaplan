import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpdateProjectMcp } from '../services/mcp.service';

// Owner-only control; the API enforces the same restriction.
export default function McpStatusRow({
  projectKey,
  enabled,
  isLoading,
  canManage,
}: {
  projectKey: string;
  enabled: boolean;
  isLoading: boolean;
  canManage: boolean;
}) {
  const t = useTranslations('mcp');
  const update = useUpdateProjectMcp(projectKey);
  const busy = isLoading || update.isPending;

  return (
    <div className="flex items-center justify-between gap-6 rounded-lg bg-muted/40 px-4 py-3.5">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('access')}</span>
          {isLoading ? (
            <Skeleton className="h-4 w-14" />
          ) : (
            <span
              className={cn(
                'text-xs font-medium',
                enabled ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {enabled ? t('enabled') : t('disabled')}
            </span>
          )}
        </div>
        {!canManage && <p className="text-sm text-muted-foreground">{t('ownerOnly')}</p>}
      </div>
      <Switch
        checked={enabled}
        disabled={!canManage || busy}
        onCheckedChange={(value) => update.mutate(value)}
        aria-label={t('toggleAria')}
      />
    </div>
  );
}
