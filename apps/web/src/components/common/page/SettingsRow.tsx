import type { ReactNode } from 'react';

// One row inside a settings group: name and description on the left, the control
// (usually a switch) on the right. `note` adds a second line, for what has to be
// done before the control applies. The dividers come from the card.
export default function SettingsRow({
  title,
  description,
  note,
  control,
}: {
  title: string;
  description: string;
  note?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 p-4">
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      {control}
    </div>
  );
}
