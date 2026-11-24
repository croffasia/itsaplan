import { useLocale, useTranslations } from 'next-intl';
import { INK, SUB, sampleDate, type SampleIssue } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';

const GRAY = '#94A3B8';
const TODAY = 12;
type Card = [key: number, title: SampleIssue, color: string];
// Five days as columns, today in the middle, each with the issues due on it.
const DAYS: [day: number, cards: Card[]][] = [
  [
    10,
    [
      [26, 'staleIssues', GRAY],
      [29, 'flakyTest', GRAY],
    ],
  ],
  [
    11,
    [
      [9, 'twoFactor', GRAY],
      [27, 'roadmap', GRAY],
    ],
  ],
  [
    12,
    [
      [7, 'feedback', '#22A06B'],
      [13, 'testKeys', '#22A06B'],
      [33, 'refunds', GRAY],
    ],
  ],
  [
    13,
    [
      [25, 'invoices', '#EAB308'],
      [21, 'releaseNotes', GRAY],
    ],
  ],
  [
    14,
    [
      [11, 'checkout', '#EAB308'],
      [6, 'webhooks', '#4C7DEB'],
    ],
  ],
];

export default function OnboardingCalendarDay() {
  const t = useTranslations('onboarding.art');
  const weekday = new Intl.DateTimeFormat(useLocale(), { weekday: 'short' });

  return (
    <g>
      <rect x="252" y="91" width="96" height="175" fill="#4C7DEB" fillOpacity=".05" />
      <path
        d="M156 90 V266 M252 90 V266 M348 90 V266 M444 90 V266 M60 134 H540"
        className="stroke-muted"
      />
      {DAYS.map(([day, cards], k) => {
        const x = 60 + k * 96;
        return (
          <g key={day}>
            <text x={x + 12} y="105" fontSize="8.5" fontWeight="500" className={SUB}>
              {weekday.format(sampleDate(day))}
            </text>
            {day === TODAY && <circle cx={x + 21} cy="121.5" r="11" fill="#4C7DEB" />}
            <text
              x={x + 21}
              y="126.5"
              textAnchor="middle"
              fontSize="14"
              fontWeight="600"
              className={day === TODAY ? 'fill-white' : INK}
            >
              {day}
            </text>
            {cards.map(([key, title, color], j) => {
              const y = 142 + j * 36;
              return (
                <g key={key}>
                  <rect
                    x={x + 6}
                    y={y}
                    width="84"
                    height="30"
                    rx="6"
                    className="fill-card stroke-border"
                  />
                  <circle cx={x + 14} cy={y + 9.5} r="2.5" fill={color} />
                  <text x={x + 20} y={y + 12.5} fontSize="8" className={SUB}>
                    ITS-{key}
                  </text>
                  <OnboardingArtText x={x + 12} y={y + 24} width={72} size={9}>
                    {t(`issues.${title}`)}
                  </OnboardingArtText>
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
