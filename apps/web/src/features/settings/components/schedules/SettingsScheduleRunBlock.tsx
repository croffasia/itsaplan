export function SettingsScheduleRunBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <pre className="overflow-x-auto rounded-md bg-muted p-3 font-sans whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}
