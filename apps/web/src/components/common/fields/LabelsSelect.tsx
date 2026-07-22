import { Tag } from 'lucide-react';
import type { Label, LabelGroup } from '@/lib/api';
import { Pill } from './Pill';
import LabelPicker from './LabelPicker';

export default function LabelsSelect({
  labels,
  groups,
  value,
  onToggle,
}: {
  labels: Label[];
  groups: LabelGroup[];
  value: number[];
  onToggle: (id: number) => void;
}) {
  const selected = labels.filter((l) => value.includes(l.id));
  return (
    <LabelPicker
      labels={labels}
      groups={groups}
      selected={value}
      onToggle={onToggle}
      trigger={
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
          {selected.length > 0
            ? `${selected.length} label${selected.length > 1 ? 's' : ''}`
            : 'Labels'}
        </Pill>
      }
    />
  );
}
