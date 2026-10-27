import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TrelloBoardOption } from '@/lib/api/endpoints/importExport';

// The boards the tested key and token can see. This component only picks; the
// parent shows the review for the picked board.
export default function SettingsImportExportTrelloBoardPicker({
  boards,
  selected,
  onSelect,
}: {
  boards: TrelloBoardOption[];
  selected: TrelloBoardOption | null;
  onSelect: (board: TrelloBoardOption | null) => void;
}) {
  const t = useTranslations('settings.importExport');

  if (boards.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('trello.noBoards')}</p>;
  }

  return (
    <div className="w-64 space-y-1.5">
      <Label htmlFor="trello-board">{t('trello.board')}</Label>
      <Select
        value={selected?.id ?? ''}
        onValueChange={(id) => onSelect(boards.find((b) => b.id === id) ?? null)}
      >
        <SelectTrigger id="trello-board" className="w-full">
          <SelectValue placeholder={t('trello.boardPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {boards.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.closed ? t('trello.closedBoard', { name: b.name }) : b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
