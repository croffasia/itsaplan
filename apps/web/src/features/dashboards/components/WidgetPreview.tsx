import type { ReactNode } from 'react';
import type { WidgetType } from '@/utils/dashboardWidgets';
import { CHART_PALETTE } from '@/utils/chartSpec';

const [INDIGO, GREEN, AMBER, PINK] = CHART_PALETTE;
const MUTED = 'fill-muted-foreground/35';
const TEXT = 'fill-foreground/70';

// Text rows are drawn as bars: at this size real text could not be read.
function bar(x: number, y: number, w: number, className = MUTED) {
  return <rect x={x} y={y} width={w} height={3} rx={1.5} className={className} />;
}

// Three list rows, each led by its own marker.
function rows(marker: (y: number, i: number) => ReactNode, widths: number[], trail?: number) {
  return [10, 20, 30].map((y, i) => (
    <g key={y}>
      {marker(y, i)}
      {bar(16, y - 1.5, widths[i], TEXT)}
      {trail != null && bar(84 - trail, y - 1.5, trail)}
    </g>
  ));
}

// A heatmap of 14 weeks by 5 days, its levels spread by a fixed pattern.
const PULSE = Array.from({ length: 70 }, (_, i) => {
  const col = Math.floor(i / 5);
  const row = i % 5;
  return { col, row, level: (col * 7 + row * 13 + ((col * row) % 5)) % 9 };
});

const DONUT = [
  { color: INDIGO, share: 0.3 },
  { color: GREEN, share: 0.4 },
  { color: AMBER, share: 0.18 },
  { color: PINK, share: 0.12 },
];
const RING = 2 * Math.PI * 12;

const THROUGHPUT = [14, 10, 10, 12, 20, 14, 12, 14, 16, 12, 12, 18, 22, 16, 14, 20];

const PREVIEW: Record<WidgetType, ReactNode> = {
  stat: (
    <>
      {bar(8, 7, 28)}
      <text x={8} y={33} fontSize={20} className="fill-foreground font-semibold">
        24
      </text>
    </>
  ),
  breakdown: (
    <>
      <g transform="rotate(-90 20 20)">
        {DONUT.map((d, i) => {
          const offset = DONUT.slice(0, i).reduce((sum, s) => sum + s.share, 0);
          return (
            <circle
              key={d.color}
              cx={20}
              cy={20}
              r={12}
              fill="none"
              stroke={d.color}
              strokeWidth={6}
              strokeDasharray={`${d.share * RING} ${RING}`}
              strokeDashoffset={-offset * RING}
            />
          );
        })}
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={44} cy={11 + i * 9} r={2} fill={DONUT[i].color} />
          {bar(50, 9.5 + i * 9, 30 - i * 6)}
        </g>
      ))}
    </>
  ),
  throughput: THROUGHPUT.map((h, i) => (
    <rect
      key={i}
      x={7 + Math.floor(i / 2) * 11 + (i % 2) * 5}
      y={36 - h}
      width={4}
      height={h}
      rx={1}
      fill={i % 2 ? GREEN : INDIGO}
    />
  )),
  burnup: (
    <g fill="none" strokeLinecap="round">
      <path d="M70 4v32" className="stroke-muted-foreground/50" strokeDasharray="2 2" />
      <path d="M4 14h26l14-3 26-1" className="stroke-muted-foreground" strokeWidth={1.5} />
      <path d="M4 34l16-4 16-5 16-4 18-3" stroke={GREEN} strokeWidth={2} />
      <path d="M70 18l20-8" stroke={GREEN} strokeWidth={1.5} strokeDasharray="3 2" />
    </g>
  ),
  pulse: PULSE.map(({ col, row, level }) => (
    <rect
      key={`${col}-${row}`}
      x={10 + col * 5.5}
      y={7 + row * 5.5}
      width={4}
      height={4}
      rx={1}
      fill={level < 4 ? undefined : GREEN}
      fillOpacity={level < 4 ? undefined : (level - 3) / 5}
      className={level < 4 ? MUTED : undefined}
    />
  )),
  recent_issues: rows(
    (y) => <circle cx={9} cy={y} r={2.5} fill="none" strokeWidth={1.5} stroke={AMBER} />,
    [52, 44, 58],
  ),
  activity_feed: rows(
    (y, i) => <circle cx={9} cy={y} r={3.5} fill={[INDIGO, PINK, GREEN][i]} />,
    [42, 34, 48],
    8,
  ),
  // A success, a failed and a queued run.
  agent_runs: rows(
    (y, i) => (
      <circle
        cx={9}
        cy={y}
        r={2.5}
        fill={[GREEN, undefined, AMBER][i]}
        className={i === 1 ? 'fill-destructive' : undefined}
      />
    ),
    [24, 30, 20],
    16,
  ),
  agent_health: (
    <>
      <text x={8} y={24} fontSize={16} className="fill-foreground font-semibold">
        94%
      </text>
      <rect x={8} y={31} width={74} height={3} rx={1.5} fill={GREEN} />
      <rect x={82} y={31} width={6} height={3} rx={1.5} className="fill-destructive" />
    </>
  ),
  webhook_health: (
    <>
      <text x={8} y={24} fontSize={16} className="fill-foreground font-semibold">
        1.2k
      </text>
      <path d="M11 29l3 5h-6z" className="fill-warning" />
      {bar(18, 30.5, 40)}
    </>
  ),
  agent_workload: [10, 20, 30].map((y, i) => (
    <g key={y}>
      {bar(8, y - 1.5, [30, 22, 26][i], TEXT)}
      {bar(60, y - 1.5, 6)}
      {bar(74, y - 1.5, 14)}
    </g>
  )),
};

// A small drawing of what a widget shows, for the widget picker. It is not the
// widget itself: that one needs data, and the picker shows the kind of view.
export default function WidgetPreview({ type }: { type: WidgetType }) {
  return (
    <svg
      viewBox="0 0 96 40"
      direction="ltr"
      aria-hidden="true"
      className="h-10 w-24 shrink-0 rounded-md bg-background"
    >
      {PREVIEW[type]}
    </svg>
  );
}
