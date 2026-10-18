import { useId } from 'react';
import styles from './infographics.module.css';

export type ArchitectureLabels = {
  title: string;
  desc: string;
  browser: string;
  web: string;
  webNote: string;
  api: string;
  apiNote: string;
  worker: string;
  workerNote: string;
  bot: string;
  botNote: string;
  postgres: string;
  runner: string;
  runnerNote: string;
  mcp: string;
  mcpNote: string;
};

const W = 140;
const H = 64;

const NODES = [
  { key: 'browser', x: 20, y: 40 },
  { key: 'mcp', x: 20, y: 160, note: 'mcpNote' },
  { key: 'runner', x: 20, y: 280, note: 'runnerNote' },
  { key: 'web', x: 210, y: 40, note: 'webNote' },
  { key: 'api', x: 400, y: 160, note: 'apiNote', core: true },
  { key: 'postgres', x: 400, y: 280, core: true },
  { key: 'worker', x: 570, y: 40, note: 'workerNote' },
  { key: 'bot', x: 570, y: 280, note: 'botNote' },
] as const;

const EDGES = [
  'M160 72 H210',
  'M350 72 H440 Q470 72 470 102 V160',
  'M160 180 H400',
  'M160 312 H350 Q380 312 380 282 V210 H400',
  'M470 224 V280',
  'M640 104 V140 Q640 150 630 150 H570 Q560 150 560 160 V302 Q560 312 550 312 H540',
  'M640 280 V220 Q640 210 630 210 H540',
];

export default function ArchitectureInfographic({ labels }: { labels: ArchitectureLabels }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 730 370"
      role="img"
      aria-labelledby={`${id}-t ${id}-d`}
      className="h-auto w-full"
      fontFamily="inherit"
    >
      <title id={`${id}-t`}>{labels.title}</title>
      <desc id={`${id}-d`}>{labels.desc}</desc>
      <g fill="none" stroke="var(--brand-mint)" strokeWidth="2" strokeLinecap="round">
        {EDGES.map((d) => (
          <path key={d} d={d} className={styles.edge} />
        ))}
      </g>
      {NODES.map((n) => {
        const core = 'core' in n;
        const note = 'note' in n ? labels[n.note] : undefined;
        return (
          <g key={n.key}>
            <rect
              x={n.x}
              y={n.y}
              width={W}
              height={H}
              rx="12"
              fill={core ? 'var(--brand-teal)' : 'var(--card)'}
              stroke={core ? 'var(--brand-teal)' : 'var(--border)'}
              strokeWidth="2"
            />
            <text
              x={n.x + W / 2}
              y={n.y + (note ? 28 : 38)}
              textAnchor="middle"
              fontSize="17"
              fontWeight="600"
              fill={core ? '#ffffff' : 'var(--foreground)'}
            >
              {labels[n.key]}
            </text>
            {note && (
              <text
                x={n.x + W / 2}
                y={n.y + 48}
                textAnchor="middle"
                fontSize="12"
                fill={core ? '#ffffff' : 'var(--muted-foreground)'}
              >
                {note}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
