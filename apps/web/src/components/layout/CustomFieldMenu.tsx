import { useState } from 'react';
import { useIconHover } from '@animateicons/react';
import { PlusIcon } from '@animateicons/react/lucide/plus-icon';
import { useTranslations } from 'next-intl';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { IssueType } from '@/lib/api/endpoints/issueTypes';
import type { PropertyKey } from '@/utils/viewSettings';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import CustomFieldRow from '@/components/layout/CustomFieldRow';
import CustomFieldTypeGroup from '@/components/layout/CustomFieldTypeGroup';

// The picker that adds custom fields to the display: global fields at the top
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
  const t = useTranslations('display.rows');
  const [open, setOpen] = useState(false);
  const [expandedType, setExpandedType] = useState<number | null>(null);
  const { ref, triggerProps } = useIconHover();

  const globalFields = customFields.filter((f) => f.issueTypeId == null);
  const typeGroups = issueTypes
    .map((type) => ({ type, fields: customFields.filter((f) => f.issueTypeId === type.id) }))
    .filter((g) => g.fields.length > 0);

  if (globalFields.length === 0 && typeGroups.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          {...triggerProps}
          type="button"
          className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed ps-1.5 pe-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <PlusIcon ref={ref} size={12} />
          {t('customField')}
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className="w-56 p-1">
        <div className="max-h-72 overflow-y-auto">
          {globalFields.map((f) => (
            <CustomFieldRow key={f.id} field={f} selected={selected} onToggle={onToggle} />
          ))}
          {typeGroups.map(({ type, fields }) => (
            <CustomFieldTypeGroup
              key={type.id}
              type={type}
              fields={fields}
              expanded={expandedType === type.id}
              onToggleExpanded={() => setExpandedType((id) => (id === type.id ? null : type.id))}
              selected={selected}
              onToggle={onToggle}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
