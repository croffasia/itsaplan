import { useEffect, useState } from 'react';
import { FilterIcon } from '@animateicons/react/lucide/filter-icon';
import { useTranslations } from 'next-intl';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { FilterSet } from '@/utils/filters';
import { useHotkeyLabel } from '@/context/useHotkeys';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import FilterCommandMenu from '@/components/layout/FilterCommandMenu';
import ToolbarIconButton from '@/components/layout/ToolbarIconButton';

// Dispatched on window by the Shell's key layer when the filter shortcut is pressed
// on the work items routes.
export const OPEN_FILTER_MENU_EVENT = 'board:open-filter';

// The filter button of the work items toolbar. It opens the filter menu, from a click
// or the filter shortcut.
export default function FilterMenuButton({
  filters,
  onChange,
  project,
  customFields,
}: {
  filters: FilterSet;
  onChange: (filters: FilterSet) => void;
  project: ProjectDetail;
  customFields: CustomField[];
}) {
  const t = useTranslations('views');
  const key = useHotkeyLabel('filter.open');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_FILTER_MENU_EVENT, show);
    return () => window.removeEventListener(OPEN_FILTER_MENU_EVENT, show);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolbarIconButton
          icon={FilterIcon}
          title={key ? `${t('filter')} (${key})` : t('filter')}
          active={open}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <FilterCommandMenu
          filters={filters}
          onChange={onChange}
          project={project}
          customFields={customFields}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
