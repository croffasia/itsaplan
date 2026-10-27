import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SettingsCard from '@/components/common/page/SettingsCard';
import type { Assignee } from '@/lib/api/endpoints/projects';
import type { TrelloArchivedCards, TrelloMemberOption } from '@/lib/api/endpoints/importExport';
import type { TrelloImportChoices } from '../../utils/importJobFields';
import SettingsImportExportTrelloMemberRow from './SettingsImportExportTrelloMemberRow';

// What only a Trello import asks before it starts: what to do with archived cards,
// and whether to match the board's members with project members by hand. Trello
// shares no member's email, so there is nothing to match them by automatically.
export default function SettingsImportExportTrelloOptions({
  members,
  people,
  value,
  onChange,
}: {
  members: TrelloMemberOption[];
  people: Assignee[];
  value: TrelloImportChoices;
  onChange: (next: TrelloImportChoices) => void;
}) {
  const t = useTranslations('settings.importExport');
  const memberMap = value.memberMap;

  function setMember(memberId: string, userId: string | null) {
    const { [memberId]: _previous, ...rest } = memberMap ?? {};
    onChange({ ...value, memberMap: userId ? { ...rest, [memberId]: userId } : rest });
  }

  return (
    <div className="space-y-6">
      <div className="w-64 space-y-1.5">
        <Label htmlFor="trello-archived-cards">{t('trello.archivedCards')}</Label>
        <Select
          value={value.archivedCards}
          onValueChange={(next) =>
            onChange({ ...value, archivedCards: next as TrelloArchivedCards })
          }
        >
          <SelectTrigger id="trello-archived-cards" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="archive">{t('trello.archivedCardsArchive')}</SelectItem>
            <SelectItem value="skip">{t('trello.archivedCardsSkip')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="w-64 space-y-1.5">
          <Label htmlFor="trello-members">{t('trello.members')}</Label>
          <Select
            value={memberMap ? 'match' : 'skip'}
            onValueChange={(next) =>
              onChange({ ...value, memberMap: next === 'match' ? {} : null })
            }
          >
            <SelectTrigger id="trello-members" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skip">{t('trello.membersSkip')}</SelectItem>
              <SelectItem value="match">{t('trello.membersMatch')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {memberMap && (
          <>
            <p className="text-xs text-muted-foreground">{t('trello.membersHint')}</p>
            <SettingsCard className="max-h-64 divide-y divide-border/60 overflow-y-auto">
              {members.map((member) => (
                <SettingsImportExportTrelloMemberRow
                  key={member.id}
                  member={member}
                  people={people}
                  value={memberMap[member.id] ?? null}
                  onChange={(userId) => setMember(member.id, userId)}
                />
              ))}
            </SettingsCard>
          </>
        )}
      </div>
    </div>
  );
}
