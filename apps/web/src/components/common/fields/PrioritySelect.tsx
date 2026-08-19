import { useTranslations } from 'next-intl';
import { usePriorityLabel } from '@/hooks/usePriorityLabel';
import { Pill } from './Pill';
import { PRIORITY_FIELDS } from './priorityFields';
import PopoverPick from './PopoverPick';

// Value is the priority string, '' for none (matches PRIORITY_FIELDS[0]).
export default function PrioritySelect({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('common.priority');
  const priorityLabel = usePriorityLabel();
  const prio = PRIORITY_FIELDS.find((p) => p.value === value) ?? PRIORITY_FIELDS[0];
  return (
    <PopoverPick
      readOnly={readOnly}
      trigger={
        <Pill active={!!value}>
          {prio.icon}
          <span className="truncate">{value ? priorityLabel(value) : t('label')}</span>
        </Pill>
      }
      inputPlaceholder={t('setTo')}
      items={PRIORITY_FIELDS.map((p) => ({
        key: p.value || 'none',
        search: priorityLabel(p.value),
        icon: p.icon,
        label: priorityLabel(p.value),
        selected: p.value === value,
        onSelect: () => onChange(p.value),
      }))}
    />
  );
}
