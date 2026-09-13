import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PlaneConnection } from './SettingsImportExport';
import type { PlaneProjectOption } from '@/lib/api/endpoints/importExport';

// The projects of the tested workspace. Selecting one is reported to the parent,
// which shows the mapping review step for it — this component only picks.
export default function SettingsImportExportProjectPicker({
  connection,
  selected,
  onSelect,
}: {
  connection: PlaneConnection;
  selected: PlaneProjectOption | null;
  onSelect: (project: PlaneProjectOption | null) => void;
}) {
  const t = useTranslations('settings.importExport');

  if (connection.projects.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noProjects')}</p>;
  }

  return (
    <div className="w-64 space-y-1.5">
      <Label htmlFor="plane-source-project">{t('sourceProjectLabel')}</Label>
      <Select
        value={selected?.id ?? ''}
        onValueChange={(id) => onSelect(connection.projects.find((p) => p.id === id) ?? null)}
      >
        <SelectTrigger id="plane-source-project" className="w-full">
          <SelectValue placeholder={t('sourceProjectPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {connection.projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name} ({p.identifier})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
