import { useLocale, useTranslations } from 'next-intl';
import { CARD, INK, SOFT, SUB } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';
import OnboardingSparkle from './OnboardingSparkle';

const GOLD = '#E9A52A';
const TEAL = '#2A9D8F';
// What each trigger cost over the window, with its bar length and colour.
const TRIGGERS = [
  { id: 'chat', bar: 120, color: '#4C7DEB', cost: 84 },
  { id: 'mention', bar: 70, color: '#8B5CF6', cost: 49 },
  { id: 'schedule', bar: 96, color: '#5A64D6', cost: 67 },
  { id: 'issueEvent', bar: 54, color: GOLD, cost: 38 },
  { id: 'workflow', bar: 136, color: TEAL, cost: 95 },
] as const;
const PEOPLE = [
  { name: 'Anna', avatar: '#F6B9A0', bar: 110, cost: 46 },
  { name: 'Ivan', avatar: '#A7C4F7', bar: 74, cost: 31 },
  { name: 'Bob', avatar: '#C3B5F2', bar: 44, cost: 18 },
];
const P95 = '330,130 360,118 390,124 420,104 450,112 480,96 510,106 540,92';
const P50 = '330,144 360,138 390,141 420,132 450,136 480,128 510,133 540,126';

// Agent spending by trigger and by person, and how long runs took.
export default function OnboardingAnalyticsArt() {
  const t = useTranslations('onboarding.art.analytics');
  const money = new Intl.NumberFormat(useLocale(), {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      <rect x="28" y="18" width="544" height="244" rx="16" className={CARD} />
      <OnboardingArtText x={48} y={46} width={300} size={13} weight={600}>
        {t('usage')}
      </OnboardingArtText>
      <rect x="456" y="32" width="100" height="22" rx="8" className={SOFT} />
      <OnboardingArtText x={465} y={47} width={86} size={9.5} weight={400} className={SUB}>
        {t('range')}
      </OnboardingArtText>

      <OnboardingArtText x={48} y={74} width={240} size={10} weight={600} className={SUB}>
        {t('byTrigger')}
      </OnboardingArtText>
      {TRIGGERS.map((trigger, i) => {
        const y = 92 + i * 28;
        return (
          <g key={trigger.id}>
            <OnboardingArtText x={48} y={y + 4} width={76} size={10} weight={400}>
              {t(`triggers.${trigger.id}`)}
            </OnboardingArtText>
            <rect x="128" y={y - 5} width={trigger.bar} height="10" rx="5" fill={trigger.color} />
            <text x={134 + trigger.bar} y={y + 4} fontSize="9.5" className={SUB}>
              {money.format(trigger.cost)}
            </text>
          </g>
        );
      })}
      <path d="M48 226 H296" className="stroke-muted" />
      <OnboardingArtText x={48} y={246} width={248} size={10.5} weight={600}>
        {t('total', { cost: money.format(333), count: 1284 })}
      </OnboardingArtText>

      <rect x="316" y="62" width="240" height="96" rx="10" className={SOFT} />
      <OnboardingArtText x={328} y={80} width={140} size={10} weight={600} className={SUB}>
        {t('runTime')}
      </OnboardingArtText>
      <circle cx="478" cy="77" r="3" fill={TEAL} />
      <text x="484" y="80" fontSize="9" className={SUB}>
        p50
      </text>
      <circle cx="514" cy="77" r="3" fill={GOLD} />
      <text x="520" y="80" fontSize="9" className={SUB}>
        p95
      </text>
      <polyline
        points={P95}
        fill="none"
        stroke={GOLD}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={P50}
        fill="none"
        stroke={TEAL}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      <rect x="316" y="166" width="240" height="84" rx="10" className={SOFT} />
      <OnboardingArtText x={328} y={184} width={212} size={10} weight={600} className={SUB}>
        {t('byPerson')}
      </OnboardingArtText>
      {PEOPLE.map((person, i) => {
        const y = 201.5 + i * 18;
        return (
          <g key={person.name}>
            <circle cx="334" cy={y - 3.5} r="6" fill={person.avatar} />
            <text x="346" y={y} fontSize="9.5" className={INK}>
              {person.name}
            </text>
            <rect
              x="392"
              y={y - 6.5}
              width={person.bar}
              height="6"
              rx="3"
              fill={GOLD}
              fillOpacity=".75"
            />
            <text x="544" y={y} textAnchor="end" fontSize="9.5" className={SUB}>
              {money.format(person.cost)}
            </text>
          </g>
        );
      })}
      <OnboardingSparkle x={14} y={30} size={7} color={GOLD} />
      <OnboardingSparkle x={586} y={252} size={6} color={GOLD} />
    </svg>
  );
}
