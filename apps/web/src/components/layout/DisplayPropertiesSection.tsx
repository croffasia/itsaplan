import { useTranslations } from 'next-intl';
import { byKey } from '@/utils/messageKey';
import type { CustomField, IssueType } from '@/lib/api';
import {
  offeredDisplayProperties,
  type PropertyKey,
  type ViewSettings,
} from '@/utils/viewSettings';
import type { WorkItemsView } from '@/utils/viewTypes';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import PropertyChip from '@/components/layout/PropertyChip';
import TableProperties from '@/components/layout/TableProperties';

// The Display properties block. On the Table layout the chips are the column
// list, sortable and extendable with custom fields; on Project they are plain
// on/off chips for the built-in properties. The Nested subtasks chip is neither a
// column nor a property — it toggles the subtask rows under a card or row — so it
// sits after the property chips.
export default function DisplayPropertiesSection({
  view,
  settings,
  onChange,
  customFields,
  issueTypes,
}: {
  view: WorkItemsView;
  settings: ViewSettings;
  onChange: (patch: Partial<ViewSettings>) => void;
  customFields: CustomField[];
  issueTypes: IssueType[];
}) {
  const t = useTranslations('display');
  const property = byKey(useTranslations('display.properties'));
  const features = useProjectFeatures();
  const properties = offeredDisplayProperties(features);

  // Enabling appends to the end (a new column shows on the right); disabling
  // removes. Order is otherwise preserved.
  const toggleProperty = (property: PropertyKey) =>
    onChange({
      properties: settings.properties.includes(property)
        ? settings.properties.filter((p) => p !== property)
        : [...settings.properties, property],
    });

  const subtasksChip = features.subtasks ? (
    <PropertyChip
      label={t('rows.nestedSubtasks')}
      on={settings.showSubtasks}
      onClick={() => onChange({ showSubtasks: !settings.showSubtasks })}
    />
  ) : null;

  return (
    <div className="space-y-3 border-t pt-2">
      <p className="px-1 text-xs font-medium text-muted-foreground">
        {t('rows.displayProperties')}
      </p>
      <div className="flex flex-wrap items-center gap-1 px-1">
        {view === 'table' ? (
          <TableProperties
            properties={settings.properties}
            customFields={customFields}
            issueTypes={issueTypes}
            onChange={(properties) => onChange({ properties })}
            trailing={subtasksChip}
          />
        ) : (
          <>
            {properties.map((p) => (
              <PropertyChip
                key={p}
                label={property(p)}
                on={settings.properties.includes(p)}
                onClick={() => toggleProperty(p)}
              />
            ))}
            {subtasksChip}
          </>
        )}
      </div>
    </div>
  );
}
