'use client';

import { useState } from 'react';
import { Check, Copy, Mail, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type InviteRow as Invite } from '@/lib/api';
import { inviteLink } from '@/utils/paths';
import { formatShortDate } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';

const STATUS_VARIANT = { pending: 'secondary', accepted: 'default', rejected: 'outline' } as const;

// One invite row: the invited email and role, its status, who sent it, and — for
// a pending invite — email, copy-link, and revoke actions. Copy reads the link from
// the current web origin so it works in any deployment.
export default function InviteRow({
  invite,
  onResend,
  onRevoke,
  resending,
}: {
  invite: Invite;
  onResend?: (invite: Invite) => void;
  onRevoke?: (invite: Invite) => void;
  resending: boolean;
}) {
  const t = useTranslations('members.invites');
  const tCommon = useTranslations('common');
  const [copied, setCopied] = useState(false);
  const pending = invite.status === 'pending';

  // When the invite last changed: its creation for a pending one, otherwise the
  // moment it was accepted or rejected.
  const timestamp = pending
    ? t('createdAt', { date: formatShortDate(invite.createdAt) })
    : invite.respondedAt
      ? t('respondedAt', { status: invite.status, date: formatShortDate(invite.respondedAt) })
      : formatShortDate(invite.createdAt);

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
            variant={STATUS_VARIANT[invite.status]}
            className="px-1.5 py-0 text-[10px] font-normal"
          >
            {t(`status.${invite.status}`)}
          </Badge>
        </ItemTitle>
        <span className="text-xs text-muted-foreground">
          {invitedBy ? t('invitedBy', { name: invitedBy }) : ''}
          {timestamp}
        </span>
      </ItemContent>
      <ItemActions className="ms-auto w-full justify-end sm:w-auto">
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
        {pending && (
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
            title={pending ? t('revokeAction') : t('removeAction')}
            onClick={revoke}
          >
            <X className="size-4" />
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}
