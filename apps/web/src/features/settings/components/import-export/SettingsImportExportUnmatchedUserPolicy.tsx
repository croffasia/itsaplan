import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UnmatchedUserPolicy } from '@/lib/api/endpoints/importExport';

// What happens to an assignee or comment author whose email matches no project member.
export default function SettingsImportExportUnmatchedUserPolicy({
  value,
  onChange,
}: {
  value: UnmatchedUserPolicy;
  onChange: (policy: UnmatchedUserPolicy) => void;
}) {
  const t = useTranslations('settings.importExport');
  return (
    <div className="w-64 space-y-1.5">
      <Label htmlFor="unmatched-user-policy">{t('unmatchedUserPolicyLabel')}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as UnmatchedUserPolicy)}>
        <SelectTrigger id="unmatched-user-policy" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">{t('unmatchedUserPolicyUnassigned')}</SelectItem>
          <SelectItem value="skip">{t('unmatchedUserPolicySkip')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
