import { useState } from 'react';
import { SlidersHorizontalIcon } from '@animateicons/react/lucide/sliders-horizontal-icon';
import { useTranslations } from 'next-intl';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { IssueType } from '@/lib/api/endpoints/issueTypes';
import type { ViewSettings } from '@/utils/viewSettings';
import type { WorkItemsView } from '@/utils/viewTypes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DisplaySettingsBody from '@/components/layout/DisplaySettingsBody';
import ToolbarIconButton from '@/components/layout/ToolbarIconButton';

// The display settings (layout switcher plus the selected layout's options) in a
// popover anchored to the sliders button.
export default function DisplayPopover({
  view,
  onViewChange,
  settings,
  onSettingsChange,
  customFields,
  issueTypes,
}: {
  view: WorkItemsView;
  onViewChange: (view: WorkItemsView) => void;
  settings: ViewSettings;
  onSettingsChange: (settings: ViewSettings) => void;
  customFields: CustomField[];
  issueTypes: IssueType[];
}) {
  const t = useTranslations('display');
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolbarIconButton icon={SlidersHorizontalIcon} title={t('title')} active={open} />
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70vh] w-88 overflow-y-auto p-2">
        <DisplaySettingsBody
          view={view}
          onViewChange={onViewChange}
          settings={settings}
          onSettingsChange={onSettingsChange}
          customFields={customFields}
          issueTypes={issueTypes}
        />
      </PopoverContent>
    </Popover>
  );
}
