import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CARD, sampleDate } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';
import OnboardingCalendarDay from './OnboardingCalendarDay';
import OnboardingCalendarMonth from './OnboardingCalendarMonth';
import OnboardingCalendarWeek from './OnboardingCalendarWeek';

export type CalendarMode = 'month' | 'byDay' | 'byWeek';

const MODES: CalendarMode[] = ['month', 'byDay', 'byWeek'];

// The calendar with its own switch between a month, the days and the weeks. The switch is
// sized in container units, so it scales with the picture.
export default function OnboardingCalendarArt({
  mode,
  onMode,
}: {
  mode: CalendarMode;
  onMode: (mode: CalendarMode) => void;
}) {
  const t = useTranslations('display.calendarModes');
  const locale = useLocale();
  const short = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const titles: Record<CalendarMode, string> = {
    month: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      sampleDate(1),
    ),
    byDay: short.formatRange(sampleDate(10), sampleDate(14)),
    byWeek: short.formatRange(sampleDate(8), sampleDate(28)),
  };

  return (
    <>
      <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
        <rect x="60" y="62" width="480" height="204" rx="14" className={CARD} />
        <OnboardingArtText x={76} y={81} width={250} size={11} weight={600}>
          {titles[mode]}
        </OnboardingArtText>
        <path d="M60 90 H540" className="stroke-border" />
        {mode === 'month' && <OnboardingCalendarMonth />}
        {mode === 'byWeek' && <OnboardingCalendarWeek />}
        {mode === 'byDay' && <OnboardingCalendarDay />}
      </svg>
      <div className="absolute end-[11.7cqw] top-[10.8cqw] flex gap-[0.35cqw] rounded-[1.2cqw] bg-muted p-[0.35cqw]">
        {MODES.map((one) => (
          <button
            key={one}
            type="button"
            aria-pressed={mode === one}
            onClick={() => onMode(one)}
            className={cn(
              'h-[3cqw] rounded-[0.8cqw] px-[1.35cqw] text-[1.75cqw] font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
              mode === one
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(one)}
          </button>
        ))}
      </div>
    </>
  );
}
