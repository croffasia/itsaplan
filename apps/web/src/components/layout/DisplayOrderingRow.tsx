import { useIconHover } from '@animateicons/react';
import { ArrowDownNarrowWideIcon } from '@animateicons/react/lucide/arrow-down-narrow-wide-icon';
import { ArrowUpNarrowWideIcon } from '@animateicons/react/lucide/arrow-up-narrow-wide-icon';
import { useTranslations } from 'next-intl';
import { byKey } from '@/utils/messageKey';
import { SORT_FIELDS, type SortField } from '@/utils/viewTypes';
import type { ViewSettings } from '@/utils/viewSettings';
import { Button } from '@/components/ui/button';
import DisplaySettingsRow from '@/components/layout/DisplaySettingsRow';
import DisplaySettingsSelect from '@/components/layout/DisplaySettingsSelect';

// A manual order has no direction, so the direction button shows only for a sort field.
export default function DisplayOrderingRow({
  sort,
  onChange,
}: {
  sort: ViewSettings['sort'];
  onChange: (sort: ViewSettings['sort']) => void;
}) {
  const t = useTranslations('display.rows');
  const sortLabel = byKey(useTranslations('display.sortFields'));
  const direction = sort.dir === 'asc' ? t('ascending') : t('descending');
  const DirectionIcon = sort.dir === 'asc' ? ArrowUpNarrowWideIcon : ArrowDownNarrowWideIcon;
  const { ref, triggerProps } = useIconHover();

  return (
    <DisplaySettingsRow label={t('ordering')}>
      {sort.field !== 'manual' && (
        <Button
          {...triggerProps}
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          title={direction}
          aria-label={direction}
          onClick={() => onChange({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
        >
          <DirectionIcon ref={ref} size={16} />
        </Button>
      )}
      <DisplaySettingsSelect
        value={sort.field}
        onChange={(v) => onChange({ ...sort, field: v as SortField })}
        options={SORT_FIELDS.map((value) => ({ value, label: sortLabel(value) }))}
      />
    </DisplaySettingsRow>
  );
}
