const EDGE = { fill: 'none', stroke: 'var(--muted-foreground)', strokeWidth: 1.5, opacity: 0.6 };
const LIVE = { fill: 'none', stroke: 'var(--foreground)', strokeWidth: 2 };
const WAY = { ...EDGE, strokeDasharray: '5 6' };
const BACK = { fill: 'none', stroke: 'var(--warning)', strokeWidth: 1.5, strokeDasharray: '6 4' };

const ARROWS = { edge: EDGE.stroke, live: LIVE.stroke, back: BACK.stroke };

// The edges of the workflow stage, in its 1136 by 288 box: dashed from each way in to its
// step, solid into the shared steps, bold where the run went, and the send back under them.
export default function SettingsWorkflowsPreviewEdges() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1136 288"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
    >
      <defs>
        {Object.entries(ARROWS).map(([id, color]) => (
          <marker
            key={id}
            id={`workflow-preview-${id}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerUnits="userSpaceOnUse"
            markerWidth="9"
            markerHeight="9"
            orient="auto"
          >
            <path d="M0 1L9 5L0 9z" fill={color} />
          </marker>
        ))}
      </defs>
      {[66, 158, 250].map((y) => (
        <path key={y} {...WAY} markerEnd="url(#workflow-preview-edge)" d={`M236 ${y}H358`} />
      ))}
      <path {...EDGE} markerEnd="url(#workflow-preview-edge)" d="M536 158H574" />
      <path {...EDGE} d="M536 250H546Q556 250 556 240V168Q556 158 566 158H574" />
      <path {...EDGE} markerEnd="url(#workflow-preview-edge)" d="M1008 158H1046" />
      <path
        {...LIVE}
        markerEnd="url(#workflow-preview-live)"
        d="M536 66H546Q556 66 556 76V148Q556 158 566 158H574"
      />
      <path {...LIVE} markerEnd="url(#workflow-preview-live)" d="M772 158H810" />
      <path
        {...BACK}
        markerEnd="url(#workflow-preview-back)"
        d="M924 196V220Q924 232 912 232H686Q674 232 674 220V198"
      />
    </svg>
  );
}
