import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// The controls of the Projects heading: Select, and what selected projects take.
export default function AccountNotificationProjectActions({
  selecting,
  anySelected,
  onSelect,
  onEdit,
  onUseDefaults,
  onTurnOff,
  onCancel,
}: {
  selecting: boolean;
  anySelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onUseDefaults: () => void;
  onTurnOff: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('account.notifications');
  const tCommon = useTranslations('common');
  return (
    <div className="-me-3 flex flex-wrap items-center gap-1 max-sm:-ms-3">
      {!selecting && (
        <Button variant="ghost" size="sm" aria-label={t('selectProjects')} onClick={onSelect}>
          {t('select')}
        </Button>
      )}
      {selecting && anySelected && (
        <>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            {t('edit')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onUseDefaults}>
            {t('useDefaults')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onTurnOff}>
            {t('turnOff')}
          </Button>
        </>
      )}
      {selecting && (
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
      )}
    </div>
  );
}
