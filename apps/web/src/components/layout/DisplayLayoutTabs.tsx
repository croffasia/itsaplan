import { useTranslations } from 'next-intl';
import { byKey } from '@/utils/messageKey';
import { useHotkeyFormatter } from '@/context/useHotkeys';
import { VIEWS, type WorkItemsView } from '@/utils/viewTypes';
import DisplaySegmented from '@/components/layout/DisplaySegmented';

// The layout switcher at the top of the Display settings. The hotkey goes in the
// tooltip when the layout has one bound.
export default function DisplayLayoutTabs({
  view,
  onViewChange,
}: {
  view: WorkItemsView;
  onViewChange: (view: WorkItemsView) => void;
}) {
  const t = byKey(useTranslations('display.layouts'));
  const hotkey = useHotkeyFormatter();

  return (
    <DisplaySegmented
      value={view}
      onChange={onViewChange}
      options={VIEWS.map(({ value, icon, hotkey: id }) => {
        const label = t(value);
        const key = hotkey(id);
        return { value, label, icon, title: key ? `${label} (${key})` : undefined };
      })}
    />
  );
}
