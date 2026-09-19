'use client';

import { Ban, MoreHorizontal, PhoneCall, ShieldOff, StickyNote } from 'lucide-react';
import type { PhoneCall as Call } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function PhoneCallActions({
  call,
  canEdit,
  canDial,
  onNote,
  onBlock,
  onDial,
}: {
  call: Call;
  canEdit: boolean;
  canDial: boolean;
  onNote: () => void;
  onBlock: () => void;
  onDial: () => void;
}) {
  // An anonymous caller has no number, so there is nothing to call back or block.
  const hasNumber = Boolean(call.externalNumber) && !call.anonymous;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onNote} disabled={!canEdit}>
          <StickyNote className="size-4" />
          Add a note
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDial} disabled={!canEdit || !canDial || !hasNumber}>
          <PhoneCall className="size-4" />
          Call back
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onBlock} disabled={!canEdit || !hasNumber}>
          {call.blocked ? <ShieldOff className="size-4" /> : <Ban className="size-4" />}
          {call.blocked ? 'Unblock caller' : 'Block caller'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
