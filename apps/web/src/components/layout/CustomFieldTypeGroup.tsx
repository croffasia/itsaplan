import { useIconHover } from '@animateicons/react';
import { ChevronDownIcon } from '@animateicons/react/lucide/chevron-down-icon';
import { ChevronRightIcon } from '@animateicons/react/lucide/chevron-right-icon';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { IssueType } from '@/lib/api/endpoints/issueTypes';
import type { PropertyKey } from '@/utils/viewSettings';
import CustomFieldRow from '@/components/layout/CustomFieldRow';

export default function CustomFieldTypeGroup({
  type,
  fields,
  expanded,
  onToggleExpanded,
  selected,
  onToggle,
}: {
  type: IssueType;
  fields: CustomField[];
  expanded: boolean;
  onToggleExpanded: () => void;
  selected: Set<string>;
  onToggle: (key: PropertyKey) => void;
}) {
  const { ref, triggerProps } = useIconHover();
  const Chevron = expanded ? ChevronDownIcon : ChevronRightIcon;
  return (
    <div>
      <button
        {...triggerProps}
        type="button"
        onClick={onToggleExpanded}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-start text-sm hover:bg-accent"
      >
        <Chevron ref={ref} size={14} className="shrink-0" />
        <span
          className="inline-block size-2 shrink-0 rounded-full"
          style={{ backgroundColor: type.color }}
        />
        <span className="flex-1 truncate">{type.name}</span>
      </button>
      {expanded && (
        <div className="ps-4">
          {fields.map((f) => (
            <CustomFieldRow key={f.id} field={f} selected={selected} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
