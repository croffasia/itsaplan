import { useTranslations } from 'next-intl';
import type { ViewSettings } from '@/utils/viewSettings';
import type { WorkItemsView } from '@/utils/viewTypes';
import DisplaySection from '@/components/layout/DisplaySection';
import DisplayToggleRow from '@/components/layout/DisplayToggleRow';

export default function DisplayShowRows({
  view,
  settings,
  onChange,
}: {
  view: WorkItemsView;
  settings: ViewSettings;
  onChange: (patch: Partial<ViewSettings>) => void;
}) {
  const t = useTranslations('display');
  return (
    <DisplaySection title={t('sections.show')}>
      {settings.group !== 'none' && (
        <DisplayToggleRow
          label={view === 'kanban' ? t('rows.emptyColumns') : t('rows.emptyGroups')}
          checked={settings.showEmptyGroups}
          onCheckedChange={(showEmptyGroups) => onChange({ showEmptyGroups })}
        />
      )}
      <DisplayToggleRow
        label={t('rows.links')}
        checked={settings.showLinks}
        onCheckedChange={(showLinks) => onChange({ showLinks })}
      />
    </DisplaySection>
  );
}
