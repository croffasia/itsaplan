'use client';

import { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { type InviteRow as Invite } from '@/lib/api';
import { inviteLink } from '@/utils/paths';
import { formatShortDate } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';

const STATUS_VARIANT = { pending: 'secondary', accepted: 'default', rejected: 'outline' } as const;

// When the invite last changed: its creation for a pending one, otherwise the
// moment it was accepted or rejected.
function timestamp(invite: Invite) {
  if (invite.status === 'pending') return `created ${formatShortDate(invite.createdAt)}`;
  if (invite.respondedAt) return `${invite.status} ${formatShortDate(invite.respondedAt)}`;
  return formatShortDate(invite.createdAt);
}

// One invite row: the invited email and role, its status, who sent it, and — for
// a pending invite — a copy-link button and a revoke action. Copy reads the link
// from the current web origin so it works in any deployment.
export default function InviteRow({
  invite,
  onRevoke,
}: {
  invite: Invite;
  onRevoke: (invite: Invite) => void;
}) {
  const [copied, setCopied] = useState(false);
  const pending = invite.status === 'pending';

  async function copy() {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    try {
      await navigator.clipboard.writeText(inviteLink(origin, invite.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (no permission / insecure origin); ignore.
    }
  }

  const invitedBy = invite.invitedByName || invite.invitedByEmail;
  // Owner invites bypass roles; a member invite shows its chosen role, falling
  // back to the default role's label when none was pinned.
  const roleLabel = invite.role === 'owner' ? 'Owner' : (invite.roleName ?? 'Member');

  return (
    <Item
      size="sm"
      className="h-14 border-0 border-b border-border last:border-b-0 hover:bg-accent/50"
    >
      <ItemContent className="gap-0.5">
        <ItemTitle className="flex items-center gap-2">
          {invite.email}
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
            {roleLabel}
          </Badge>
          <Badge
            variant={STATUS_VARIANT[invite.status]}
            className="px-1.5 py-0 text-[10px] font-normal capitalize"
          >
            {invite.status}
          </Badge>
        </ItemTitle>
        <span className="text-xs text-muted-foreground">
          {invitedBy ? `Invited by ${invitedBy} · ` : ''}
          {timestamp(invite)}
        </span>
      </ItemContent>
      <ItemActions>
        {pending && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={copy}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          title={pending ? 'Revoke invite' : 'Remove invite'}
          onClick={() => onRevoke(invite)}
        >
          <X className="size-4" />
        </Button>
      </ItemActions>
    </Item>
  );
}
