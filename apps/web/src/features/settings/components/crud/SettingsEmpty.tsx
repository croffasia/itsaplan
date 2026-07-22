import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { useSettingsCan } from '../../context/settingsPermission';

export function SettingsEmpty({
  title,
  description,
  addLabel,
  onAdd,
}: {
  title: string;
  description: string;
  // Optional: pages whose add action lives in the page header omit it here.
  addLabel?: string;
  onAdd?: () => void;
}) {
  const can = useSettingsCan();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg p-6 text-center">
      <EmptyHeader className="gap-1">
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        <EmptyDescription className="text-xs">{description}</EmptyDescription>
      </EmptyHeader>
      {onAdd && can('create') && (
        <EmptyContent>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onAdd}>
            <Plus className="size-3.5" />
            {addLabel}
          </Button>
        </EmptyContent>
      )}
    </div>
  );
}
