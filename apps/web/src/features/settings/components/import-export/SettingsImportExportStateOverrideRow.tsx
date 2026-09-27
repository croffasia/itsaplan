import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PlaneStateOption, StateCategory } from '@/lib/api/endpoints/importExport';

const STATE_CATEGORIES: StateCategory[] = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
];

// One Plane state and the itsaplan category it will be created with, changeable
// from what the automatic mapping picked. A row of the card its parent renders
// (divide-y, this component only supplies its own padding).
export default function SettingsImportExportStateOverrideRow({
  state,
  value,
  onChange,
}: {
  state: PlaneStateOption;
  value: StateCategory;
  onChange: (category: StateCategory) => void;
}) {
  const stateTypes = useTranslations('display');
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm">{state.name}</span>
      <Select value={value} onValueChange={(next) => onChange(next as StateCategory)}>
        <SelectTrigger size="sm" className="w-36 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATE_CATEGORIES.map((category) => (
            <SelectItem key={category} value={category}>
              {stateTypes(`stateTypes.${category}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
