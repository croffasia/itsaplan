import { useTranslations } from 'next-intl';
import type { IssueSyncMode } from '@/lib/api/endpoints/git';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MODES: IssueSyncMode[] = ['off', 'one_way', 'two_way'];

export default function GitIssueSyncModeSelect({
  value,
  onChange,
}: {
  value: IssueSyncMode;
  onChange: (mode: IssueSyncMode) => void;
}) {
  const t = useTranslations('settings.git');
  return (
    <Select value={value} onValueChange={(next) => onChange(next as IssueSyncMode)}>
      <SelectTrigger className="w-36" aria-label={t('issueSync')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MODES.map((mode) => (
          <SelectItem key={mode} value={mode}>
            {t(`issueSyncModes.${mode}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
