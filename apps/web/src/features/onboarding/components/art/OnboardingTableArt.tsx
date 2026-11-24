import { useLocale, useTranslations } from 'next-intl';
import { CARD, SOFT, SUB, sampleDate, type SampleIssue } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';
import OnboardingStateIcon, { type OnboardingState } from './OnboardingStateIcon';

const PRIORITY = {
  high: { bars: 3, color: '#F97316' },
  medium: { bars: 2, color: '#EAB308' },
  low: { bars: 1, color: '#9AA0AC' },
} as const;

const ROWS: {
  key: number;
  title: SampleIssue;
  state: OnboardingState;
  priority: keyof typeof PRIORITY;
  avatar: string;
  due: number;
  late?: boolean;
}[] = [
  { key: 11, title: 'checkout', state: 'inProgress', priority: 'high', avatar: '#F6B9A0', due: 14 },
  {
    key: 12,
    title: 'webhooks',
    state: 'inProgress',
    priority: 'medium',
    avatar: '#A7C4F7',
    due: 19,
  },
  {
    key: 17,
    title: 'refunds',
    state: 'todo',
    priority: 'medium',
    avatar: '#C3B5F2',
    due: 8,
    late: true,
  },
  {
    key: 15,
    title: 'invoices',
    state: 'review',
    priority: 'low',
    avatar: '#9ED9C9',
    due: 9,
    late: true,
  },
  {
    key: 9,
    title: 'twoFactor',
    state: 'todo',
    priority: 'high',
    avatar: '#F6B9A0',
    due: 11,
    late: true,
  },
  { key: 13, title: 'testKeys', state: 'done', priority: 'low', avatar: '#A7C4F7', due: 6 },
];

// Issues grouped under an initiative, with their state, priority, assignee and due date;
// the ones past due show it in red.
export default function OnboardingTableArt() {
  const t = useTranslations('onboarding.art');
  const tColumns = useTranslations('workItems.columns');
  const tPriority = useTranslations('common.priority');
  const tDisplay = useTranslations('display.properties');
  const locale = useLocale();
  const day = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const headers = [
    { x: 76, width: 210, label: tColumns('title') },
    { x: 300, width: 80, label: tColumns('status') },
    { x: 386, width: 58, label: tColumns('priority') },
    { x: 450, width: 34, label: tDisplay('assignee') },
    { x: 488, width: 44, label: tColumns('dueDate') },
  ];

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      <rect x="60" y="62" width="480" height="204" rx="14" className={CARD} />
      {headers.map((header) => (
        <OnboardingArtText
          key={header.x}
          x={header.x}
          y={82}
          width={header.width}
          size={9.5}
          weight={600}
          className={SUB}
        >
          {header.label}
        </OnboardingArtText>
      ))}
      <rect x="60" y="90" width="480" height="1" className="fill-border" />
      <circle cx="80" cy="102.5" r="3.5" fill="#7C5CE6" />
      <OnboardingArtText x={90} y={106} width={200} size={10.5} weight={600}>
        {t('initiative')}
        <tspan dx="6" fontWeight="400" className={SUB}>
          {ROWS.length}
        </tspan>
      </OnboardingArtText>
      {ROWS.map((row, i) => {
        const cy = 124 + i * 24;
        const priority = PRIORITY[row.priority];
        return (
          <g key={row.key}>
            {i > 0 && <rect x="60" y={cy - 12} width="480" height="1" className={SOFT} />}
            <text x="76" y={cy + 3.5} fontSize="9.5" className={SUB}>
              ITS-{row.key}
            </text>
            <OnboardingArtText x={116} y={cy + 3.5} width={176} size={10.5}>
              {t(`issues.${row.title}`)}
            </OnboardingArtText>
            <OnboardingStateIcon state={row.state} cx={306} cy={cy} />
            <OnboardingArtText x={316} y={cy + 3.5} width={66} size={10} weight={400}>
              {t(`states.${row.state}`)}
            </OnboardingArtText>
            {[0, 1, 2].map((bar) => (
              <rect
                key={bar}
                x={388 + bar * 3.4}
                y={cy + 1 - bar * 2}
                width="2.4"
                height={3 + bar * 2}
                rx=".6"
                fill={bar < priority.bars ? priority.color : undefined}
                className={bar < priority.bars ? undefined : 'fill-border'}
              />
            ))}
            <OnboardingArtText x={402} y={cy + 3.5} width={44} size={10} weight={400}>
              {tPriority(row.priority)}
            </OnboardingArtText>
            <circle cx="460" cy={cy} r="7" fill={row.avatar} />
            <rect
              x="478"
              y={cy - 8}
              width="48"
              height="16"
              rx="5"
              className={row.late ? 'fill-destructive/12' : SOFT}
            />
            <text
              x="502"
              y={cy + 3}
              textAnchor="middle"
              fontSize="9.5"
              className={row.late ? 'fill-destructive' : SUB}
            >
              {day.format(sampleDate(row.due))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
