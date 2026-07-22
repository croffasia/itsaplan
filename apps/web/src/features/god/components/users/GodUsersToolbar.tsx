'use client';

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
  return (
    <div className="flex flex-wrap items-center gap-3">
      <GodSearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Search by name or email"
        className="min-w-[240px] flex-1"
      />

      <Select value={kind} onValueChange={(v) => onKindChange(v as InstanceUserKind)}>
        <SelectTrigger className="h-9 w-[160px]" aria-label="Account kind">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="human">Humans</SelectItem>
          <SelectItem value="agent">AI bots</SelectItem>
          <SelectItem value="all">All accounts</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
