'use client';

import { useState } from 'react';
import { Check, Copy, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InviteRow } from '@/lib/api/endpoints/invites';
import { isInviteExpired } from '@/utils/invites';
import { inviteLink } from '@/utils/paths';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatShortDate } from '@/utils/dates';

// An expired invite's link no longer works, so it offers a renewal in place of copying
// that link.
export default function TeamInviteRow({
  invite,
  onRevoke,
  onRenew,
  renewing,
}: {
  invite: InviteRow;
  onRevoke: (invite: InviteRow) => void;
  // Left out when the viewer may not renew this invite: the API would refuse it.
  onRenew?: (invite: InviteRow) => void;
  renewing: boolean;
}) {
  const t = useTranslations('teams.invite');
  const tManage = useTranslations('teams.manage');
  const [copied, setCopied] = useState(false);
  const expired = isInviteExpired(invite);

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

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm">
          {invite.projectName ? t('joinsProject', { project: invite.projectName }) : t('joinsTeam')}
        </span>
        <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] font-normal">
          {tManage(`roles.${invite.teamRole}`)}
        </Badge>
        <span
          className={cn('shrink-0 text-xs', expired ? 'text-destructive' : 'text-muted-foreground')}
        >
          {expired ? t('expiredAt', { date: formatShortDate(invite.expiresAt!) }) : t('pending')}
        </span>
      </div>
      <div className="ms-auto flex items-center justify-end gap-1">
        {expired ? (
          onRenew && (
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
          )
        ) : (
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
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          title={t('revokeAction')}
          onClick={() => onRevoke(invite)}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
