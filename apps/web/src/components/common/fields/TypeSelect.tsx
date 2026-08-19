import { CircleDashed } from 'lucide-react';
import type { IssueType } from '@/lib/api';
import { colorDot } from './colorDot';
import { Pill } from './Pill';
import PopoverPick from './PopoverPick';
import { useTranslations } from 'next-intl';

export default function TypeSelect({
  issueTypes,
  value,
  onChange,
  readOnly,
}: {
  issueTypes: IssueType[];
  value: number | null;
  onChange: (id: number | null) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('issue.fieldSelects');
  const type = issueTypes.find((t) => t.id === value);
  return (
    <PopoverPick
      readOnly={readOnly}
      trigger={
        <Pill active={!!type}>
          {type ? colorDot(type.color) : <CircleDashed />}
          <span className="truncate">{type?.name ?? t('type')}</span>
        </Pill>
      }
      inputPlaceholder={t('changeType')}
      items={[
        {
          key: 'none',
          search: t('noType'),
          icon: <CircleDashed />,
          label: t('noType'),
          selected: value == null,
          onSelect: () => onChange(null),
        },
        ...issueTypes.map((t) => ({
          key: String(t.id),
          search: t.name,
          icon: colorDot(t.color),
          label: t.name,
          selected: t.id === value,
          onSelect: () => onChange(t.id),
        })),
      ]}
    />
  );
}
