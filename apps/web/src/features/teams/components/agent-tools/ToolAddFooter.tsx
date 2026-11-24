import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { ToolIntegrationEntry } from '../../hooks/useAddTools';

// The bottom row of the add-tool dialog: what is selected across integrations and the
// button that adds it.
export function ToolAddFooter({
  pending,
  busy,
  onClear,
  onCancel,
  onSubmit,
}: {
  pending: ToolIntegrationEntry[];
  busy: boolean;
  onClear: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const t = useTranslations('teams.tools');
  const tCommon = useTranslations('common');
  const total = pending.reduce((sum, e) => sum + e.pending.length, 0);

  return (
    <div className="flex items-center gap-3">
      {total > 0 && (
        <>
          <span className="shrink-0 text-xs font-medium text-foreground">
            {t('selectedCount', { count: total })}
          </span>
          {pending.length > 1 && (
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {pending.map((e) => `${e.integration.label} ${e.pending.length}`).join(' · ')}
            </span>
          )}
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('clearGroup')}
          </button>
        </>
      )}
      <div className="ms-auto flex shrink-0 gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {tCommon('cancel')}
        </Button>
        <Button onClick={onSubmit} disabled={total === 0 || busy}>
          {t('addCount', { count: total })}
        </Button>
      </div>
    </div>
  );
}
