import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PlaneStateOption, StateCategory } from '@/lib/api/endpoints/importJobs';

const STATE_CATEGORIES: StateCategory[] = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
];

// One Plane state and the itsaplan category it will be created with, changeable
// from what the automatic mapping picked.
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
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm">{state.name}</span>
      <Select value={value} onValueChange={(next) => onChange(next as StateCategory)}>
        <SelectTrigger className="w-40">
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
