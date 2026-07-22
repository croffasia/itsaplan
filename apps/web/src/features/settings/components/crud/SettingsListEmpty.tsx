import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettingsCan } from '../../context/settingsPermission';

// The first-run state for a settings list. Sits on a quiet muted panel with a min
// height so an empty tab reads as a defined area, not a void. Shared by the settings
// CRUD tabs.
export function SettingsListEmpty({
  icon: Icon,
  title,
  description,
  addLabel,
  onAdd,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  // The add action is optional: pages that expose it in the page header instead
  // omit it here, so the empty state stays a plain message.
  addLabel?: string;
  onAdd?: () => void;
}) {
  const can = useSettingsCan();
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-xl bg-muted/30 px-6 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm">
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {onAdd && can('create') && (
        <Button size="sm" className="h-8 gap-1.5" onClick={onAdd}>
          <Plus className="size-3.5" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
