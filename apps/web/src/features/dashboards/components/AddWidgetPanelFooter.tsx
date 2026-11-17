import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// How many widgets were added since the add panel opened, with Undo for the last one.
export default function AddWidgetPanelFooter({
  count,
  onUndo,
  onClose,
}: {
  count: number;
  onUndo: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('dashboards');
  const tCommon = useTranslations('common');
  return (
    <div className="flex items-center gap-3 border-t px-5 py-3">
      <span role="status" className="min-w-0 truncate text-sm text-muted-foreground">
        {t('addPanel.status', { count })}
      </span>
      {count > 0 && (
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 rounded-sm text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t('addPanel.undo')}
        </button>
      )}
      <Button variant="secondary" size="sm" className="ms-auto" onClick={onClose}>
        {tCommon('close')}
      </Button>
    </div>
  );
}
