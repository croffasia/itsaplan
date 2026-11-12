import { useLocale, useTranslations } from 'next-intl';
import { Clock, SquareKanban } from 'lucide-react';
import { CARD, SUB, sampleDate } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';
import OnboardingEventSchedule from './OnboardingEventSchedule';
import OnboardingSparkle from './OnboardingSparkle';

const INDIGO = '#5A64D6';
const ICON = 'text-[#3F48B5] dark:text-[#8B93EE]';

// The schedules every edition has, by time and by an issue entering a state, with their
// runs, beside the event schedule Pro adds.
export default function OnboardingSchedulesArt() {
  const t = useTranslations('onboarding.art.schedules');
  const tStates = useTranslations('onboarding.art.states');
  const locale = useLocale();
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
  const when = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  const schedules = [
    {
      y: 46,
      Icon: Clock,
      title: t('weeklyReport'),
      sub: t('everyMonday', { time: time.format(sampleDate(16, 9)) }),
    },
    {
      y: 114,
      Icon: SquareKanban,
      title: t('reviewFix'),
      sub: t('entersState', { state: tStates('review') }),
    },
  ];
  const runs = [
    { y: 216.5, title: t('weeklyReport'), when: when.format(sampleDate(16, 9)), done: true },
    { y: 232.5, title: t('reviewFix'), when: when.format(sampleDate(17, 14, 12)), done: true },
    { y: 248.5, title: t('triageBugs'), when: t('running'), done: false },
  ];

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      <rect x="24" y="20" width="84" height="18" rx="9" className="fill-card" />
      <OnboardingArtText x={34} y={32.5} width={68} size={9.5} weight={600} className={SUB}>
        {t('community')}
      </OnboardingArtText>
      {schedules.map(({ y, Icon, title, sub }) => (
        <g key={y}>
          <rect x="24" y={y} width="240" height="58" rx="12" className={CARD} />
          <rect x="36" y={y + 13} width="32" height="32" rx="9" fill={INDIGO} fillOpacity=".14" />
          <Icon x={44} y={y + 21} width={16} height={16} className={ICON} />
          <OnboardingArtText x={80} y={y + 26} width={176} size={12} weight={600}>
            {title}
          </OnboardingArtText>
          <OnboardingArtText x={80} y={y + 42} width={176} size={10} weight={400} className={SUB}>
            {sub}
          </OnboardingArtText>
        </g>
      ))}
      <rect x="24" y="182" width="240" height="76" rx="12" className={CARD} />
      <OnboardingArtText x={36} y={200} width={200} size={10} weight={600} className={SUB}>
        {t('runHistory')}
      </OnboardingArtText>
      {runs.map((run) => (
        <g key={run.y}>
          {run.done ? (
            <g>
              <circle cx="41" cy={run.y - 3.5} r="4.5" fill="#22A06B" />
              <path
                d={`M39 ${run.y - 3.5} l1.4 1.4 l2.8 -3`}
                stroke="#fff"
                strokeWidth="1.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ) : (
            <g>
              <circle
                cx="41"
                cy={run.y - 3.5}
                r="4.5"
                strokeWidth="1.6"
                fill="none"
                className="stroke-border"
              />
              <path
                d={`M41 ${run.y - 8} A4.5 4.5 0 0 1 45.5 ${run.y - 3.5}`}
                stroke={INDIGO}
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
            </g>
          )}
          <OnboardingArtText x={52} y={run.y} width={124} size={9.5} weight={400}>
            {run.title}
          </OnboardingArtText>
          <text x="252" y={run.y} textAnchor="end" fontSize="9.5" className={SUB}>
            {run.when}
          </text>
        </g>
      ))}
      <OnboardingEventSchedule />
      <OnboardingSparkle x={270} y={12} size={6} color={INDIGO} />
    </svg>
  );
}
