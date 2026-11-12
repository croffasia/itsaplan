import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CARD, GOLD_ICON, GOLD_SOFT, GOLD_STROKE, SUB } from '../../utils/art';
import OnboardingArtText from './OnboardingArtText';

// A step on the workflow canvas: its icon, name and task, and how far the run got with it.
export default function OnboardingWorkflowNode({
  x,
  y,
  width,
  Icon,
  title,
  sub,
  state,
}: {
  x: number;
  y: number;
  width: number;
  Icon: LucideIcon;
  title: string;
  sub: string;
  state?: 'done' | 'running' | 'waiting';
}) {
  const dot = { cx: x + width - 10, cy: y + 10 };
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height="56"
        rx="12"
        strokeWidth={state === 'running' ? 1.5 : 1}
        className={cn(CARD, state === 'running' ? GOLD_STROKE : 'stroke-border')}
      />
      <rect x={x + 10} y={y + 14} width="28" height="28" rx="8" className={GOLD_SOFT} />
      <Icon x={x + 16} y={y + 20} width={16} height={16} className={GOLD_ICON} />
      <OnboardingArtText x={x + 46} y={y + 25} width={width - 62} size={11} weight={600}>
        {title}
      </OnboardingArtText>
      <OnboardingArtText
        x={x + 46}
        y={y + 40}
        width={width - 52}
        size={9.5}
        weight={400}
        className={SUB}
      >
        {sub}
      </OnboardingArtText>
      {state === 'done' && (
        <g>
          <circle cx={dot.cx} cy={dot.cy} r="6" fill="#22A06B" />
          <path
            d={`M${dot.cx - 2.6} ${dot.cy} l1.8 1.8 l3.4 -3.6`}
            stroke="#fff"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
      {state === 'running' && (
        <g>
          <circle
            cx={dot.cx}
            cy={dot.cy}
            r="6"
            strokeWidth="2"
            fill="none"
            className="stroke-border"
          />
          <path
            d={`M${dot.cx} ${dot.cy - 6} A6 6 0 0 1 ${dot.cx + 6} ${dot.cy}`}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            className={GOLD_STROKE}
          />
        </g>
      )}
      {state === 'waiting' && (
        <circle
          cx={dot.cx}
          cy={dot.cy}
          r="6"
          strokeWidth="1.6"
          strokeDasharray="2.5 2.5"
          fill="none"
          className="stroke-muted-foreground"
        />
      )}
    </g>
  );
}
