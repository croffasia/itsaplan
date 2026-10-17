export default function AgentRunBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre
        dir="auto"
        className="max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-xs break-words whitespace-pre-wrap"
      >
        {text}
      </pre>
    </div>
  );
}
