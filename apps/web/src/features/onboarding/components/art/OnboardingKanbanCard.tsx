import { CARD, LINE, SUB } from '../../utils/art';

// A card of the kanban picture: its key, two lines for the title, the colour tag of its
// type, or a check once it is done, and its assignee.
export default function OnboardingKanbanCard({
  x,
  y,
  issueKey,
  tag,
  avatar,
}: {
  x: number;
  y: number;
  issueKey: number;
  tag?: string;
  avatar: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width="108" height="50" rx="8" className={CARD} />
      <text x={x + 10} y={y + 12} fontSize="8.5" className={SUB}>
        ITS-{issueKey}
      </text>
      <rect x={x + 10} y={y + 17} width="72" height="6" rx="3" className={LINE} />
      <rect x={x + 10} y={y + 27} width="46" height="6" rx="3" className={LINE} />
      {tag ? (
        <rect x={x + 10} y={y + 38} width="22" height="7" rx="3.5" fill={tag} />
      ) : (
        <g>
          <circle cx={x + 15} cy={y + 41.5} r="5" fill="#22A06B" />
          <path
            d={`M${x + 12.6} ${y + 41.5} l1.8 1.8 l3.4 -3.6`}
            stroke="#fff"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
      <circle cx={x + 94} cy={y + 41.5} r="6" fill={avatar} />
    </g>
  );
}
