import { useState } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import type { CustomField, IssueType } from '@/lib/api';
import type { PropertyKey } from '@/utils/viewSettings';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import CustomFieldRow from '@/components/layout/CustomFieldRow';

// The "…" picker that adds custom fields to the display: global fields at the top
// level, each issue type an expandable sub-list of its type-scoped fields.
// Nothing renders when the project has no custom fields.
export default function CustomFieldMenu({
  customFields,
  issueTypes,
  selected,
  onToggle,
}: {
  customFields: CustomField[];
  issueTypes: IssueType[];
  selected: Set<string>;
  onToggle: (key: PropertyKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expandedType, setExpandedType] = useState<number | null>(null);

  const globalFields = customFields.filter((f) => f.issueTypeId == null);
  const typeGroups = issueTypes
    .map((type) => ({ type, fields: customFields.filter((f) => f.issueTypeId === type.id) }))
    .filter((g) => g.fields.length > 0);

  if (globalFields.length === 0 && typeGroups.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Add custom field"
          className="flex items-center rounded-full border px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className="w-56 p-1">
        <div className="max-h-72 overflow-y-auto">
          {globalFields.map((f) => (
            <CustomFieldRow key={f.id} field={f} selected={selected} onToggle={onToggle} />
          ))}
          {typeGroups.map(({ type, fields }) => (
            <div key={type.id}>
              <button
                type="button"
                onClick={() => setExpandedType((id) => (id === type.id ? null : type.id))}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {expandedType === type.id ? (
                  <ChevronDown className="size-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0" />
                )}
                <span
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: type.color }}
                />
                <span className="flex-1 truncate">{type.name}</span>
              </button>
              {expandedType === type.id && (
                <div className="pl-4">
                  {fields.map((f) => (
                    <CustomFieldRow key={f.id} field={f} selected={selected} onToggle={onToggle} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
