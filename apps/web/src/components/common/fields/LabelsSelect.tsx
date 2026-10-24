import { type ReactNode } from 'react';
import { Tag } from 'lucide-react';
import type { Label, LabelGroup } from '@/lib/api/endpoints/labels';
import { Pill } from './Pill';
import ReadOnlyPill from './ReadOnlyPill';
import LabelPicker from './LabelPicker';
import { useTranslations } from 'next-intl';

export default function LabelsSelect({
  labels,
  groups,
  value,
  onToggle,
  readOnly,
  trigger: ownTrigger,
}: {
  labels: Label[];
  groups: LabelGroup[];
  value: number[];
  onToggle: (id: number) => void;
  readOnly?: boolean;
  // Replaces the pill where a caller needs its own (a Timeline cell).
  trigger?: ReactNode;
}) {
  const t = useTranslations('issue.fieldSelects');
  const selected = labels.filter((l) => value.includes(l.id));
  const trigger = ownTrigger ?? (
    <Pill active={selected.length > 0}>
      {selected.length > 0 ? (
        <span className="flex -space-x-1">
          {selected.slice(0, 3).map((l) => (
            <span
              key={l.id}
              className="size-2.5 rounded-full border border-popover"
              style={{ backgroundColor: l.color }}
            />
          ))}
        </span>
      ) : (
        <Tag />
      )}
      <span className="truncate">
        {selected.length > 0 ? t('labelCount', { count: selected.length }) : t('labels')}
      </span>
    </Pill>
  );
  if (readOnly) return <ReadOnlyPill>{trigger}</ReadOnlyPill>;
  return (
    <LabelPicker
      labels={labels}
      groups={groups}
      selected={value}
      onToggle={onToggle}
      trigger={trigger}
    />
  );
}
