import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// One row inside a settings group: name and description on the left, the control
// (usually a switch) on the right. `note` is what has to be done before the control
// applies, set apart from the description so the reason a switch cannot be moved is
// not read as more of its explanation. The dividers come from the card.
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
      <div className="max-w-2xl space-y-1">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {note && (
          <Alert className="mt-2 w-fit bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">
            <Info />
            <AlertDescription className="text-xs text-current">{note}</AlertDescription>
          </Alert>
        )}
      </div>
      {control}
    </div>
  );
}
