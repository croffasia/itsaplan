// How much the operator trusts the statement, 0-100. Drawn rather than printed:
// the exact number matters less than whether a fact is solid or shaky.
export default function MindConfidenceBar({ confidence }: { confidence: number }) {
  return (
    <span className="flex items-center gap-2" title={`Confidence ${confidence}%`}>
      <span className="text-xs tracking-wide text-muted-foreground uppercase">Confidence</span>
      <span className="h-1 w-14 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-foreground/70"
          style={{ width: `${Math.max(0, Math.min(100, confidence))}%` }}
        />
      </span>
    </span>
  );
}
