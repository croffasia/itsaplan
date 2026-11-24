import { useLocale, useTranslations } from 'next-intl';
import { SUB, sampleDate, type SampleIssue } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';

const GRAY = '#94A3B8';
type Item = [key: number, title: SampleIssue, color: string];
// Three weeks side by side, each with the days that have issues due. The first is the
// current one.
const WEEKS: { number: number; from: number; to: number; days: [day: number, items: Item[]][] }[] =
  [
    {
      number: 46,
      from: 8,
      to: 14,
      days: [
        [
          8,
          [
            [17, 'refunds', GRAY],
            [9, 'twoFactor', GRAY],
          ],
        ],
        [
          9,
          [
            [15, 'invoices', GRAY],
            [21, 'releaseNotes', GRAY],
          ],
        ],
        [12, [[7, 'feedback', '#22A06B']]],
      ],
    },
    {
      number: 47,
      from: 15,
      to: 21,
      days: [
        [15, [[30, 'roadmap', GRAY]]],
        [16, [[22, 'releaseNotes', '#F97316']]],
        [17, [[4, 'invoices', GRAY]]],
        [19, [[12, 'webhooks', '#EAB308']]],
      ],
    },
    {
      number: 48,
      from: 22,
      to: 28,
      days: [
        [24, [[31, 'twoFactor', GRAY]]],
        [28, [[23, 'checkout', GRAY]]],
      ],
    },
  ];

export default function OnboardingCalendarWeek() {
  const t = useTranslations('onboarding.art');
  const locale = useLocale();
  const range = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const dayLabel = new Intl.DateTimeFormat(locale, { day: 'numeric', weekday: 'short' });

  return (
    <g>
      <path d="M220 90 V266 M380 90 V266" className="stroke-muted" />
      {WEEKS.map((week, w) => {
        const x = 60 + w * 160;
        let y = 140;
        const rows = week.days.flatMap(([day, items]) => {
          const label = { kind: 'day' as const, y, day };
          y += 13;
          const lines = items.map((item) => {
            const line = { kind: 'item' as const, y, item };
            y += 14;
            return line;
          });
          y += 4;
          return [label, ...lines];
        });
        return (
          <g key={week.number}>
            {w === 0 && (
              <rect
                x={x + 7}
                y="95"
                width="48"
                height="14"
                rx="4"
                fill="#4C7DEB"
                fillOpacity=".16"
              />
            )}
            <OnboardingArtText
              x={x + 12}
              y={105}
              width={140}
              size={8.5}
              weight={600}
              className={w === 0 ? 'fill-[#2F5FCC] dark:fill-[#7FA4F5]' : SUB}
            >
              {t('week', { number: week.number })}
            </OnboardingArtText>
            <OnboardingArtText x={x + 12} y={122} width={140} size={11} weight={600}>
              {range.formatRange(sampleDate(week.from), sampleDate(week.to))}
            </OnboardingArtText>
            {rows.map((row) =>
              row.kind === 'day' ? (
                <text
                  key={`d${row.y}`}
                  x={x + 12}
                  y={row.y}
                  fontSize="8.5"
                  fontWeight="500"
                  className={SUB}
                >
                  {dayLabel.format(sampleDate(row.day))}
                </text>
              ) : (
                <g key={`i${row.y}`}>
                  <circle cx={x + 15} cy={row.y - 3} r="2.5" fill={row.item[2]} />
                  <text x={x + 22} y={row.y} fontSize="8.5" className={SUB}>
                    ITS-{row.item[0]}
                  </text>
                  <OnboardingArtText x={x + 52} y={row.y} width={100} size={9.5}>
                    {t(`issues.${row.item[1]}`)}
                  </OnboardingArtText>
                </g>
              ),
            )}
          </g>
        );
      })}
    </g>
  );
}
