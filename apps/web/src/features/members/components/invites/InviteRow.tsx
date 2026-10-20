'use client';

import { useState } from 'react';
import { Check, Copy, Mail, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InviteRow as Invite } from '@/lib/api/endpoints/invites';
import { isInviteExpired } from '@/utils/invites';
import { inviteLink } from '@/utils/paths';
import { formatShortDate } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';

const STATUS_VARIANT = { pending: 'secondary', accepted: 'default', rejected: 'outline' } as const;

// One invite row: the invited email and role, its status, who sent it, and — for
// a pending invite — email, copy-link (when the API sent its token), and revoke
// actions. Copy reads the link from the current web origin so it works in any
// deployment. An expired invite offers no link to copy or mail, only a renewal,
// which sends a new one.
export default function InviteRow({
  invite,
  onResend,
  onRenew,
  onRevoke,
  resending,
  renewing,
}: {
  invite: Invite;
  onResend?: (invite: Invite) => void;
  onRenew?: (invite: Invite) => void;
  onRevoke?: (invite: Invite) => void;
  resending: boolean;
  renewing: boolean;
}) {
  const t = useTranslations('members.invites');
  const tCommon = useTranslations('common');
  const [copied, setCopied] = useState(false);
  const expired = invite.status === 'pending' && isInviteExpired(invite);
  const pending = invite.status === 'pending' && !expired;

  let timestamp: string;
  if (expired) {
    timestamp = t('expiredAt', { date: formatShortDate(invite.expiresAt!) });
  } else if (pending) {
    timestamp = t('createdAt', { date: formatShortDate(invite.createdAt) });
  } else if (invite.respondedAt) {
    timestamp = t('respondedAt', {
      status: invite.status,
      date: formatShortDate(invite.respondedAt),
    });
  } else {
    timestamp = formatShortDate(invite.createdAt);
  }

  async function copy() {
    if (!invite.token) return;
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    try {
      await navigator.clipboard.writeText(inviteLink(origin, invite.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (no permission / insecure origin); ignore.
    }
  }

  function resend() {
    onResend?.(invite);
  }

  function revoke() {
    onRevoke?.(invite);
  }

  const invitedBy = invite.invitedByName || invite.invitedByEmail;
  // Owner invites bypass roles; a member invite shows its chosen role, falling
  // back to the default role's label when none was pinned.
  const roleLabel =
    invite.role === 'owner' ? tCommon('owner') : (invite.roleName ?? tCommon('member'));

  return (
    <Item
      size="sm"
      className="min-h-14 border-0 border-b border-border last:border-b-0 hover:bg-accent/50"
    >
      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle className="max-w-full flex-wrap">
          <span className="break-all">{invite.email}</span>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
            {roleLabel}
          </Badge>
          <Badge
            variant={expired ? 'destructive' : STATUS_VARIANT[invite.status]}
            className="px-1.5 py-0 text-[10px] font-normal"
          >
            {expired ? t('status.expired') : t(`status.${invite.status}`)}
          </Badge>
        </ItemTitle>
        <span className="text-xs text-muted-foreground">
          {invitedBy ? t('invitedBy', { name: invitedBy }) : ''}
          {timestamp}
        </span>
      </ItemContent>
      <ItemActions className="ms-auto w-full justify-end sm:w-auto">
        {expired && onRenew && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            disabled={renewing}
            onClick={() => onRenew(invite)}
          >
            <RefreshCw className="size-3.5" />
            {renewing ? t('renewing') : t('renew')}
          </Button>
        )}
        {pending && onResend && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            disabled={resending}
            onClick={resend}
          >
            <Mail className="size-3.5" />
            {resending ? t('resendingEmail') : t('resendEmail')}
          </Button>
        )}
        {pending && invite.token && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={copy}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? t('copied') : t('copyLink')}
          </Button>
        )}
        {onRevoke && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            title={pending || expired ? t('revokeAction') : t('removeAction')}
            onClick={revoke}
          >
            <X className="size-4" />
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}
