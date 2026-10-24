import { useTranslations } from 'next-intl';
import { byKey } from '@/utils/messageKey';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { IssueType } from '@/lib/api/endpoints/issueTypes';
import {
  DISPLAY_PROPERTIES,
  isTimelineField,
  offeredDisplayProperties,
  type PropertyKey,
  type ViewSettings,
} from '@/utils/viewSettings';
import type { WorkItemsView } from '@/utils/viewTypes';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import PropertyChip from '@/components/layout/PropertyChip';
import ColumnProperties from '@/components/layout/ColumnProperties';

// The Display properties block. On the Table and the Timeline the chips are the
// column list, sortable and extendable with custom fields; on Project they are plain
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
  // The Timeline offers neither the identifier, which its title column always
  // shows, nor a text or markdown field, and toggles the subtasks in a row of its own.
  const timeline = view === 'timeline';

  return (
    <div className="space-y-3 border-t pt-2">
      <p className="px-1 text-xs font-medium text-muted-foreground">
        {t('rows.displayProperties')}
      </p>
      <div className="flex flex-wrap items-center gap-1 px-1">
        {view === 'table' || timeline ? (
          <ColumnProperties
            properties={settings.properties}
            builtins={timeline ? DISPLAY_PROPERTIES.filter((p) => p !== 'id') : DISPLAY_PROPERTIES}
            customFields={timeline ? customFields.filter(isTimelineField) : customFields}
            issueTypes={issueTypes}
            onChange={(properties) => onChange({ properties })}
            trailing={timeline ? null : subtasksChip}
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
