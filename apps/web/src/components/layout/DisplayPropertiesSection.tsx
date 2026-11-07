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
import DisplaySection from '@/components/layout/DisplaySection';

// The properties an issue shows. On the Kanban they are plain on/off chips for the
// card; on the Table and the Timeline they are the columns, sortable and extendable
// with custom fields.
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

  if (view === 'kanban') {
    const toggle = (p: PropertyKey) =>
      onChange({
        properties: settings.properties.includes(p)
          ? settings.properties.filter((k) => k !== p)
          : [...settings.properties, p],
      });
    return (
      <DisplaySection title={t('sections.cardProperties')}>
        <div className="flex flex-wrap gap-x-1 gap-y-1.5 px-2 pt-1">
          {offeredDisplayProperties(features).map((p) => (
            <PropertyChip
              key={p}
              label={property(p)}
              on={settings.properties.includes(p)}
              onClick={() => toggle(p)}
            />
          ))}
        </div>
      </DisplaySection>
    );
  }

  // The Timeline offers neither the identifier, which its title column always
  // shows, nor a text or markdown field.
  const timeline = view === 'timeline';
  return (
    <DisplaySection title={t('sections.columns')} hint={t('rows.dragToReorder')}>
      <ColumnProperties
        properties={settings.properties}
        builtins={timeline ? DISPLAY_PROPERTIES.filter((p) => p !== 'id') : DISPLAY_PROPERTIES}
        customFields={timeline ? customFields.filter(isTimelineField) : customFields}
        issueTypes={issueTypes}
        onChange={(properties) => onChange({ properties })}
      />
    </DisplaySection>
  );
}
