import { useIconHover } from '@animateicons/react';
import { CheckIcon } from '@animateicons/react/lucide/check-icon';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import { customFieldKey, type PropertyKey } from '@/utils/viewSettings';

export default function CustomFieldRow({
  field,
  selected,
  onToggle,
}: {
  field: CustomField;
  selected: Set<string>;
  onToggle: (key: PropertyKey) => void;
}) {
  const on = selected.has(customFieldKey(field.id));
  const { ref, triggerProps } = useIconHover();
  return (
    <button
      {...triggerProps}
      type="button"
      onClick={() => onToggle(customFieldKey(field.id))}
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-accent"
    >
      <span className="flex-1 truncate">{field.name}</span>
      {on && <CheckIcon ref={ref} size={14} className="shrink-0" />}
    </button>
  );
}
