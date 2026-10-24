import type { ReactNode } from 'react';
import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';
import { byKey } from '@/utils/messageKey';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { IssueType } from '@/lib/api/endpoints/issueTypes';
import { useDndSensors } from '@/lib/dnd';
import {
  customFieldId,
  isCustomFieldKey,
  isFieldEnabled,
  type DisplayProperty,
  type PropertyKey,
} from '@/utils/viewSettings';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import CustomFieldMenu from '@/components/layout/CustomFieldMenu';
import PropertyChip from '@/components/layout/PropertyChip';
import SortablePropertyChip from '@/components/layout/SortablePropertyChip';

// The Display-properties chips of a layout that shows properties as columns (Table,
// Timeline): enabled properties first as a horizontal sortable list (drag to
// reorder — this is the column order), then the not-yet-shown built-in properties,
// then the "…" custom-field picker. Clicking an enabled chip removes it; clicking a
// disabled one adds it (to the end). onChange receives the new ordered `properties`
// list. A stored key the layout does not render gets no chip.
export default function ColumnProperties({
  properties,
  builtins,
  customFields,
  issueTypes,
  onChange,
  trailing,
}: {
  properties: PropertyKey[];
  // The built-in properties the layout renders; `customFields` holds only the fields
  // it renders. One whose section is off is not offered, but keeps its chip while
  // enabled, so it can still be removed.
  builtins: DisplayProperty[];
  customFields: CustomField[];
  issueTypes: IssueType[];
  onChange: (properties: PropertyKey[]) => void;
  // Chips that are not columns, rendered after the property list and before the
  // custom-field picker, which stays last.
  trailing?: ReactNode;
}) {
  const t = byKey(useTranslations('display.properties'));
  const sensors = useDndSensors();
  const fieldById = new Map(customFields.map((f) => [f.id, f]));
  const rendered = new Set<PropertyKey>(builtins);
  const labelFor = (key: PropertyKey): string | null => {
    if (isCustomFieldKey(key)) return fieldById.get(customFieldId(key))?.name ?? null;
    return rendered.has(key) ? t(key) : null;
  };

  const enabled = properties.filter((k) => labelFor(k) != null);
  const enabledSet = new Set(properties);
  const features = useProjectFeatures();
  const disabledBuiltins = builtins.filter(
    (p) => !enabledSet.has(p) && isFieldEnabled(p, features),
  );

  const toggle = (key: PropertyKey) =>
    onChange(enabledSet.has(key) ? properties.filter((p) => p !== key) : [...properties, key]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = enabled.indexOf(active.id as PropertyKey);
    const to = enabled.indexOf(over.id as PropertyKey);
    if (from === -1 || to === -1) return;
    onChange(arrayMove(enabled, from, to));
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={enabled} strategy={rectSortingStrategy}>
          {enabled.map((key) => (
            <SortablePropertyChip
              key={key}
              id={key}
              label={labelFor(key)!}
              onClick={() => toggle(key)}
            />
          ))}
        </SortableContext>
      </DndContext>
      {disabledBuiltins.map((p) => (
        <PropertyChip key={p} label={t(p)} on={false} onClick={() => toggle(p)} />
      ))}
      {trailing}
      <CustomFieldMenu
        customFields={customFields}
        issueTypes={issueTypes}
        selected={enabledSet}
        onToggle={toggle}
      />
    </>
  );
}
