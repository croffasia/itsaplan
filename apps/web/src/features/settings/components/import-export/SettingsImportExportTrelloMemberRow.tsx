import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Assignee } from '@/lib/api/endpoints/projects';
import type { TrelloMemberOption } from '@/lib/api/endpoints/importExport';

// A Select item cannot carry an empty value.
const NOT_MATCHED = 'not-matched';

// One Trello member and the project member it is matched with, if any. A row of
// the card its parent renders.
export default function SettingsImportExportTrelloMemberRow({
  member,
  people,
  value,
  onChange,
}: {
  member: TrelloMemberOption;
  people: Assignee[];
  value: string | null;
  onChange: (userId: string | null) => void;
}) {
  const t = useTranslations('settings.importExport');
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm">
        {member.fullName || member.username}{' '}
        <span className="text-muted-foreground">@{member.username}</span>
      </span>
      <Select
        value={value ?? NOT_MATCHED}
        onValueChange={(next) => onChange(next === NOT_MATCHED ? null : next)}
      >
        <SelectTrigger size="sm" className="w-48 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NOT_MATCHED}>{t('trello.memberNotMatched')}</SelectItem>
          {people.map((person) => (
            <SelectItem key={person.userId} value={person.userId}>
              {person.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
