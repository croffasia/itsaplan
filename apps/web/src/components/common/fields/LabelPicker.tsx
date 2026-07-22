import { useMemo, type ReactNode } from 'react';
import type { Label, LabelGroup } from '@/lib/api';
import { groupLabels } from '@/utils/labels';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import LabelPickerSection from './LabelPickerSection';

// The label selector shared by the issue fields and the filter bar. Type-ahead (a
// letter jumps to the matching row) comes from the underlying menu.
export default function LabelPicker({
  labels,
  groups,
  selected,
  onToggle,
  trigger,
}: {
  labels: Label[];
  groups: LabelGroup[];
  selected: number[];
  onToggle: (id: number) => void;
  trigger: ReactNode;
}) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const sections = useMemo(() => groupLabels(labels, groups), [labels, groups]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {sections.length === 0 && (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No labels.</p>
        )}
        {sections.map((section) => (
          <LabelPickerSection
            key={section.group?.id ?? 'ungrouped'}
            group={section.group}
            labels={section.labels}
            selected={selectedSet}
            onToggle={onToggle}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
