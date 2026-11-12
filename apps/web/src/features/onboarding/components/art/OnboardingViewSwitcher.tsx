import { useTranslations } from 'next-intl';
import { CalendarDays, ChartGantt, Columns3, Table } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WorkView = 'kanban' | 'table' | 'timeline' | 'calendar';

const VIEWS = [
  { id: 'kanban', Icon: Columns3 },
  { id: 'table', Icon: Table },
  { id: 'timeline', Icon: ChartGantt },
  { id: 'calendar', Icon: CalendarDays },
] as const;

// Sized in container units, so it scales with the picture under it.
export default function OnboardingViewSwitcher({
  view,
  onView,
}: {
  view: WorkView;
  onView: (view: WorkView) => void;
}) {
  const t = useTranslations('display.layouts');

  return (
    <div className="absolute top-[2.3cqw] left-1/2 flex -translate-x-1/2 gap-[0.35cqw] rounded-full bg-card p-[0.7cqw] shadow-[0_8px_14px_rgba(24,24,48,0.1)] dark:shadow-[0_10px_18px_rgba(0,0,0,0.5)]">
      {VIEWS.map(({ id, Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          onClick={() => onView(id)}
          className={cn(
            'flex h-[5cqw] items-center gap-[1cqw] rounded-full px-[2cqw] text-[2cqw] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
            view === id
              ? 'bg-[#4C7DEB]/15 text-[#2F5FCC] dark:bg-[#7FA4F5]/20 dark:text-[#7FA4F5]'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="size-[2.4cqw]" />
          {t(id)}
        </button>
      ))}
    </div>
  );
}
