import { Check } from 'lucide-react';
import type { CustomField } from '@/lib/api';
import { customFieldKey, type PropertyKey } from '@/utils/viewSettings';

// One selectable custom field in the picker.
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
  return (
    <button
      type="button"
      onClick={() => onToggle(customFieldKey(field.id))}
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
    >
      <span className="flex-1 truncate">{field.name}</span>
      {on && <Check className="size-3.5 shrink-0" />}
    </button>
  );
}
