import { useId } from 'react';
import { ICONS, type IconName } from '@/components/brand/icons';
import styles from './infographics.module.css';

export type AgentRunLabels = {
  title: string;
  desc: string;
  assign: string;
  budget: string;
  run: string;
  result: string;
};

const STEPS: { key: keyof AgentRunLabels; icon: IconName }[] = [
  { key: 'assign', icon: 'agent' },
  { key: 'budget', icon: 'budget' },
  { key: 'run', icon: 'runner' },
  { key: 'result', icon: 'check' },
];

export default function AgentRunInfographic({ labels }: { labels: AgentRunLabels }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 640 150"
      role="img"
      aria-labelledby={`${id}-t ${id}-d`}
      className="h-auto w-full text-brand-teal dark:text-brand-mint"
      fontFamily="inherit"
    >
      <title id={`${id}-t`}>{labels.title}</title>
      <desc id={`${id}-d`}>{labels.desc}</desc>
      <path
        d="M110 50 H530"
        fill="none"
        stroke="var(--brand-mint)"
        strokeWidth="2"
        strokeLinecap="round"
        className={styles.edge}
      />
      {STEPS.map((step, i) => {
        const cx = 80 + i * 160;
        return (
          <g key={step.key}>
            <circle
              cx={cx}
              cy="50"
              r="34"
              fill="var(--card)"
              stroke="currentColor"
              strokeWidth="2"
            />
            <g
              transform={`translate(${cx - 18} 32) scale(1.5)`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {ICONS[step.icon].line}
            </g>
            <text
              x={cx}
              y="122"
              textAnchor="middle"
              fontSize="20"
              fontWeight="600"
              fill="var(--foreground)"
            >
              {labels[step.key]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
