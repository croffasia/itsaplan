import { useTranslations } from 'next-intl';
import { INK, SOFT, SUB } from '../../utils/art';
import OnboardingCursor from './OnboardingCursor';
import OnboardingKanbanCard from './OnboardingKanbanCard';
import OnboardingSparkle from './OnboardingSparkle';
import OnboardingStateIcon from './OnboardingStateIcon';

const BLUE = '#4C7DEB';
// The cards standing in the columns; a card without a tag is done.
const CARDS = [
  { col: 0, row: 0, key: 17, tag: '#F97316', avatar: '#F6B9A0' },
  { col: 0, row: 1, key: 29, tag: '#EAB308', avatar: '#A7C4F7' },
  { col: 0, row: 2, key: 30, tag: '#9AA0AC', avatar: '#C3B5F2' },
  { col: 1, row: 0, key: 12, tag: BLUE, avatar: '#9ED9C9' },
  { col: 2, row: 0, key: 13, avatar: '#F6B9A0' },
  { col: 2, row: 1, key: 7, avatar: '#A7C4F7' },
];
const COLUMNS = [
  { x: 104, state: 'todo', count: 3 },
  { x: 238, state: 'inProgress', count: 2 },
  { x: 372, state: 'done', count: 2 },
] as const;

// A board with one card being dragged to the next column.
export default function OnboardingKanbanArt() {
  const t = useTranslations('onboarding.art.states');

  return (
    <svg viewBox="0 0 600 280" className="absolute inset-0 size-full" aria-hidden="true">
      {COLUMNS.map((column) => (
        <g key={column.state}>
          <rect x={column.x} y="66" width="124" height="200" rx="12" className={SOFT} />
          <OnboardingStateIcon state={column.state} cx={column.x + 14} cy={82} />
          <svg x={column.x + 24} y="74" width="96" height="16" overflow="hidden">
            <text y="11.5" fontSize="10" fontWeight="600" className={INK}>
              {t(column.state)}
              <tspan dx="5" fontWeight="400" className={SUB}>
                {column.count}
              </tspan>
            </text>
          </svg>
        </g>
      ))}
      {CARDS.map((card) => (
        <OnboardingKanbanCard
          key={card.key}
          x={112 + card.col * 134}
          y={94 + card.row * 56}
          issueKey={card.key}
          tag={card.tag}
          avatar={card.avatar}
        />
      ))}
      <rect
        x="246"
        y="150"
        width="108"
        height="50"
        rx="8"
        fill={BLUE}
        fillOpacity=".06"
        stroke={BLUE}
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <g transform="rotate(5 316 171)">
        <OnboardingKanbanCard x={262} y={146} issueKey={11} tag="#F97316" avatar="#C3B5F2" />
      </g>
      <OnboardingCursor x={334} y={186} />
      <OnboardingSparkle x={70} y={40} size={7} color={BLUE} />
      <OnboardingSparkle x={528} y={248} size={9} color={BLUE} />
    </svg>
  );
}
