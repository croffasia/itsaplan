'use client';

import { useTranslations } from 'next-intl';
import type { InstanceUserKind } from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import GodSearchInput from '../GodSearchInput';

// Search and the kind filter above the directory. Both drive server-side queries,
// so a change here refetches a page rather than filtering what is on screen.
export default function GodUsersToolbar({
  search,
  onSearchChange,
  kind,
  onKindChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  kind: InstanceUserKind;
  onKindChange: (value: InstanceUserKind) => void;
}) {
  const t = useTranslations('god.users');

  return (
    <div className="flex flex-wrap items-center gap-3">
      <GodSearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={t('searchPlaceholder')}
        className="min-w-[240px] flex-1"
      />

      <Select value={kind} onValueChange={(v) => onKindChange(v as InstanceUserKind)}>
        <SelectTrigger className="h-9 w-[160px]" aria-label={t('kind')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="human">{t('kinds.human')}</SelectItem>
          <SelectItem value="agent">{t('kinds.agent')}</SelectItem>
          <SelectItem value="all">{t('kinds.all')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
