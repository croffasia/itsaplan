import type { KeyboardEvent } from 'react';
import { OPERATORS_BY_KIND, type FieldSpec } from '@/utils/filterFields';
import { toDateStr } from '@/utils/dates';
import { useFilterFields } from '@/hooks/useFilterFields';
import { Calendar } from '@/components/ui/calendar';

// The step of a date field: picking a day adds the condition with it, under the
// field's first operator, which the condition can switch later.
export default function FilterMenuDate({
  spec,
  onAdd,
  onBack,
}: {
  spec: FieldSpec;
  onAdd: (day: string) => void;
  onBack: () => void;
}) {
  const { operatorLabel } = useFilterFields();
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      onBack();
    }
  };
  return (
    <div onKeyDown={onKeyDown}>
      <p className="flex items-center gap-2 px-3 pt-3 text-sm text-muted-foreground [&_svg]:size-4">
        {spec.icon}
        {spec.label} {operatorLabel(OPERATORS_BY_KIND[spec.kind][0])}
      </p>
      <Calendar
        mode="single"
        fixedWeeks
        autoFocus
        onSelect={(day) => day && onAdd(toDateStr(day))}
      />
    </div>
  );
}
