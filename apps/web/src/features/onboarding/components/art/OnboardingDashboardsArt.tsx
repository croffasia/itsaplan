import { useTranslations } from 'next-intl';
import { CARD, INK, LINE, SOFT, SUB } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';
import OnboardingSparkle from './OnboardingSparkle';
import OnboardingWidgetPicker from './OnboardingWidgetPicker';

const TEAL = '#2A9D8F';
// Weekly created and closed counts for the throughput widget.
const WEEKS = [
  [40, 30],
  [56, 44],
  [34, 40],
  [62, 52],
  [48, 46],
  [70, 58],
];
// The breakdown donut: share of the circle and colour per state.
const SEGMENTS = [
  { length: 70.4, offset: 0, color: '#94A3B8' },
  { length: 44, offset: -70.4, color: '#EAB308' },
  { length: 26.4, offset: -114.4, color: '#8B5CF6' },
  { length: 35.1, offset: -140.8, color: '#22A06B' },
];

// A dashboard of widgets with the widget picker open beside it.
export default function OnboardingDashboardsArt() {
  const t = useTranslations('dashboards');
  const tArt = useTranslations('onboarding.art');
  const stats = [
    { label: t('defaultWidgets.open'), value: '33' },
    { label: t('defaultWidgets.inProgress'), value: '10' },
    { label: t('defaultWidgets.backlog'), value: '7' },
  ];

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      <rect x="40" y="18" width="80" height="26" rx="8" className={CARD} />
      <OnboardingArtText x={52} y={35} width={62} size={11} weight={600}>
        {t('defaultName')}
      </OnboardingArtText>
      <OnboardingArtText x={134} y={35} width={78} size={11} className={SUB}>
        {tArt('sprintHealth')}
      </OnboardingArtText>
      <OnboardingArtText x={220} y={35} width={140} size={11} className={SUB}>
        + {t('newDashboard')}
      </OnboardingArtText>

      <rect x="40" y="54" width="370" height="210" rx="16" className={CARD} />
      {stats.map((stat, i) => (
        <g key={stat.value}>
          <rect x={52 + i * 117} y="66" width="108" height="52" rx="10" className={SOFT} />
          <OnboardingArtText x={62 + i * 117} y={82} width={90} size={9.5} className={SUB}>
            {stat.label}
          </OnboardingArtText>
          <text x={62 + i * 117} y="108" fontSize="22" fontWeight="700" className={INK}>
            {stat.value}
          </text>
        </g>
      ))}
      <rect x="52" y="128" width="170" height="124" rx="10" className={SOFT} />
      <OnboardingArtText x={62} y={144} width={150} size={9.5} weight={600} className={SUB}>
        {t('widgets.throughput.label')}
      </OnboardingArtText>
      {WEEKS.map(([created, closed], i) => (
        <g key={i}>
          <rect x={66 + i * 25} y={240 - created} width="9" height={created} rx="2" fill={TEAL} />
          <rect
            x={77 + i * 25}
            y={240 - closed}
            width="9"
            height={closed}
            rx="2"
            fill={TEAL}
            fillOpacity=".4"
          />
        </g>
      ))}
      <rect x="232" y="128" width="166" height="124" rx="10" className={SOFT} />
      <OnboardingArtText x={242} y={144} width={130} size={9.5} weight={600} className={SUB}>
        {t('widgets.breakdown.label')}
      </OnboardingArtText>
      {SEGMENTS.map((segment) => (
        <circle
          key={segment.color}
          cx="282"
          cy="198"
          r="28"
          fill="none"
          stroke={segment.color}
          strokeWidth="10"
          strokeDasharray={`${segment.length} 175.9`}
          strokeDashoffset={segment.offset}
          transform="rotate(-90 282 198)"
        />
      ))}
      {SEGMENTS.map((segment, i) => (
        <g key={segment.color}>
          <circle cx="326" cy={178 + i * 14} r="3" fill={segment.color} />
          <rect x="334" y={175 + i * 14} width={34 - i * 3} height="6" rx="3" className={LINE} />
        </g>
      ))}

      <OnboardingWidgetPicker />
      <OnboardingSparkle x={578} y={30} size={9} color={TEAL} />
      <OnboardingSparkle x={24} y={250} size={7} color={TEAL} />
    </svg>
  );
}
