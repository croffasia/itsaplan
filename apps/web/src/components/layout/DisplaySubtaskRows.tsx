import { useTranslations } from 'next-intl';
import type { ViewSettings } from '@/utils/viewSettings';
import type { WorkItemsView } from '@/utils/viewTypes';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import DisplaySection from '@/components/layout/DisplaySection';
import DisplayToggleRow from '@/components/layout/DisplayToggleRow';

export default function DisplaySubtaskRows({
  view,
  settings,
  onChange,
}: {
  view: WorkItemsView;
  settings: ViewSettings;
  onChange: (patch: Partial<ViewSettings>) => void;
}) {
  const t = useTranslations('display');
  const features = useProjectFeatures();
  if (!features.subtasks) return null;

  const kanban = view === 'kanban';
  return (
    <DisplaySection title={t('sections.subtasks')}>
      <DisplayToggleRow
        label={kanban ? t('rows.separateCards') : t('rows.separateRows')}
        checked={settings.separateSubtasks}
        onCheckedChange={(separateSubtasks) => onChange({ separateSubtasks })}
      />
      <DisplayToggleRow
        label={kanban ? t('rows.nestedInCard') : t('rows.nestedInRow')}
        checked={settings.showSubtasks}
        onCheckedChange={(showSubtasks) => onChange({ showSubtasks })}
      />
      <DisplayToggleRow
        label={t('rows.subtasksCollapsed')}
        checked={settings.collapseSubtasks}
        onCheckedChange={(collapseSubtasks) => onChange({ collapseSubtasks })}
      />
    </DisplaySection>
  );
}
