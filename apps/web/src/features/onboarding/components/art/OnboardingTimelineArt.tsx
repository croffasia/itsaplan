import { useLocale, useTranslations } from 'next-intl';
import { CARD, SUB, sampleDate } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';

const BLUE = '#4C7DEB';
const FIRST_DAY = 9;
const DAYS = 15;
const TODAY = 3;
// Each bar: the issue, the day columns it spans and its colour.
const BARS = [
  { key: 11, title: 'checkout', from: 1, to: 7, color: '#EAB308', text: 'fill-[#3D2C06]' },
  { key: 12, title: 'webhooks', from: 3, to: 10, color: '#22A06B', text: 'fill-white' },
  { key: 17, title: 'refunds', from: 6, to: 11, color: '#8B5CF6', text: 'fill-white' },
  { key: 15, title: 'invoices', from: 2, to: 5, color: '#64748B', text: 'fill-white' },
  { key: 9, title: 'twoFactor', from: 8, to: 14, color: BLUE, text: 'fill-white' },
  { key: 21, title: 'releaseNotes', from: 11, to: 15, color: '#F97316', text: 'fill-white' },
] as const;

const col = (day: number) => 208 + day * 22;

// The issues of the active cycle as bars over the days, today marked, and one issue
// waiting on another.
export default function OnboardingTimelineArt() {
  const t = useTranslations('onboarding.art');
  const tColumns = useTranslations('workItems.columns');
  const locale = useLocale();
  const month = new Intl.DateTimeFormat(locale, { month: 'long' }).format(sampleDate(1));

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      <rect x="60" y="62" width="480" height="204" rx="14" className={CARD} />
      <path
        d={Array.from({ length: DAYS - 1 }, (_, k) => `M${col(k + 1)} 88 V266`).join(' ')}
        className="stroke-muted"
      />
      <rect x={col(TODAY)} y="88" width="22" height="178" fill={BLUE} fillOpacity=".07" />
      <path d="M60 88 H540 M208 62 V266" className="stroke-border" />
      <OnboardingArtText x={76} y={80} width={120} size={9.5} weight={600} className={SUB}>
        {tColumns('title')}
      </OnboardingArtText>
      <OnboardingArtText x={216} y={72} width={120} size={8.5} weight={600} className={SUB}>
        {month}
      </OnboardingArtText>
      <circle cx={col(TODAY) + 11} cy="81" r="6.5" fill={BLUE} />
      {Array.from({ length: DAYS }, (_, k) => (
        <text
          key={k}
          x={col(k) + 11}
          y="84"
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="500"
          className={k === TODAY ? 'fill-white' : SUB}
        >
          {FIRST_DAY + k}
        </text>
      ))}
      <path d={`M${col(TODAY) + 11} 88 V266`} stroke={BLUE} strokeWidth="1.5" />
      <circle cx="80" cy="104" r="3.5" fill="#EAB308" />
      <OnboardingArtText x={90} y={107.5} width={112} size={10} weight={600}>
        {t('activeCycle', { number: 13 })}
      </OnboardingArtText>
      {BARS.map((bar, i) => {
        const cy = 128 + i * 24;
        return (
          <g key={bar.key}>
            <text x="76" y={cy + 3.5} fontSize="9.5" className={SUB}>
              ITS-{bar.key}
            </text>
            <OnboardingArtText x={112} y={cy + 3.5} width={90} size={10.5}>
              {t(`issues.${bar.title}`)}
            </OnboardingArtText>
            <rect
              x={col(bar.from)}
              y={cy - 8}
              width={(bar.to - bar.from) * 22}
              height="16"
              rx="5"
              fill={bar.color}
            />
            <OnboardingArtText
              x={col(bar.from) + 8}
              y={cy + 3}
              width={(bar.to - bar.from) * 22 - 12}
              size={9}
              weight={600}
              className={bar.text}
            >
              {t(`issues.${bar.title}`)}
            </OnboardingArtText>
          </g>
        );
      })}
      <path
        d={`M${col(5)} 200 H${col(5) + 12} V224 H${col(8) - 5}`}
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
        className="stroke-muted-foreground"
      />
      <path
        d={`M${col(8) - 9} 220 L${col(8) - 4} 224 L${col(8) - 9} 228`}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-muted-foreground"
      />
    </svg>
  );
}
