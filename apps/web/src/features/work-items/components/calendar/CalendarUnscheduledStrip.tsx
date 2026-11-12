import { ChevronsLeftRightIcon } from '@animateicons/react/lucide/chevrons-left-right-icon';
import { useTranslations } from 'next-intl';
import type { DateField } from '@/utils/viewSettings';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ToolbarIconButton from '@/components/layout/ToolbarIconButton';
import { dateFieldWording, UNSCHEDULED_ID } from '../../utils/calendar';
import { CalendarDropZone } from './CalendarDropZone';

// The unscheduled panel collapsed to a narrow strip, like a collapsed Kanban column.
// It still takes a drop that clears an issue's date.
export function CalendarUnscheduledStrip({
  dateField,
  count,
  onExpand,
}: {
  dateField: DateField;
  count: number;
  onExpand: () => void;
}) {
  const t = useTranslations('workItems');
  return (
    <CalendarDropZone
      id={UNSCHEDULED_ID}
      className="flex shrink-0 items-center gap-2 border-t p-3 sm:w-10 sm:flex-col sm:border-e sm:border-t-0 sm:px-0"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <ToolbarIconButton
            icon={ChevronsLeftRightIcon}
            className="p-1"
            onClick={onExpand}
            aria-label={t('expand')}
          />
        </TooltipTrigger>
        <TooltipContent>{t('expand')}</TooltipContent>
      </Tooltip>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground sm:[writing-mode:vertical-rl]">
        {t(`calendar.noDate.${dateFieldWording(dateField)}`)}
        <span>{count}</span>
      </div>
    </CalendarDropZone>
  );
}
