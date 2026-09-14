import type { MindOverview } from '@/lib/api';

// The shape of the memory: the busiest facts around a centre, sized by how much
// links into them. The layout is radial and computed from the order the API
// returns, so it is deterministic — no physics, no library, and it renders the
// same on the server and the client.
export default function MindGraph({
  hubs,
  totalFacts,
}: {
  hubs: MindOverview['mostLinked'];
  totalFacts: number;
}) {
  const width = 320;
  const height = 200;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 74;
  const busiest = Math.max(...hubs.map((hub) => hub.linksIn + hub.linksOut), 1);

  const nodes = hubs.map((hub, index) => {
    // Start at the top and walk clockwise, so adding a hub does not reshuffle the
    // ones already drawn.
    const angle = (index / Math.max(hubs.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const links = hub.linksIn + hub.linksOut;
    return {
      ...hub,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      r: 3 + (links / busiest) * 5,
    };
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      role="img"
      aria-label={`${totalFacts} facts, ${hubs.length} of them hubs`}
    >
      {nodes.map((node) => (
        <line
          key={`edge-${node.id}`}
          x1={cx}
          y1={cy}
          x2={node.x}
          y2={node.y}
          className="stroke-border"
          strokeWidth="1"
        />
      ))}
      <circle cx={cx} cy={cy} r="11" className="fill-foreground/10" />
      <circle cx={cx} cy={cy} r="5" className="fill-foreground/70" />
      {nodes.map((node) => (
        <g key={node.id}>
          <circle cx={node.x} cy={node.y} r={node.r} className="fill-card stroke-foreground/60" />
          <text
            x={node.x}
            y={node.y - node.r - 5}
            textAnchor="middle"
            className="fill-muted-foreground text-[7px]"
          >
            {node.title.length > 22 ? `${node.title.slice(0, 21)}…` : node.title}
          </text>
        </g>
      ))}
    </svg>
  );
}
