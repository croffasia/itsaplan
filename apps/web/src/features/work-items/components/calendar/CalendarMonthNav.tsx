import { addMonths, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function CalendarMonthNav({
  cursor,
  onCursorChange,
}: {
  cursor: Date;
  onCursorChange: (date: Date) => void;
}) {
  const t = useTranslations('workItems.calendar');
  const format = useFormatter();
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-sm font-medium text-foreground">
        {format.dateTime(cursor, { month: 'long', year: 'numeric' })}
      </h2>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onCursorChange(addMonths(cursor, -1))}
              aria-label={t('previousMonth')}
            >
              <ChevronLeft />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('previousMonth')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onCursorChange(addMonths(cursor, 1))}
              aria-label={t('nextMonth')}
            >
              <ChevronRight />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('nextMonth')}</TooltipContent>
        </Tooltip>
      </div>
      <Button variant="outline" size="sm" onClick={() => onCursorChange(startOfMonth(new Date()))}>
        {t('today')}
      </Button>
    </div>
  );
}
