'use client';

import { useState } from 'react';
import { Check, Copy, Mail, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InviteRow } from '@/lib/api/endpoints/invites';
import { inviteLink } from '@/utils/paths';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';

// One pending invite of the team: the invited address, what it grants — a rank in
// the team, or a project it also joins — a copy-link button and a revoke action.
export default function TeamInviteRow({
  invite,
  onRevoke,
}: {
  invite: InviteRow;
  onRevoke: (invite: InviteRow) => void;
}) {
  const t = useTranslations('teams.invite');
  const tManage = useTranslations('teams.manage');
  const [copied, setCopied] = useState(false);

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
    <TableRow className="hover:bg-transparent">
      <TableCell className="px-3 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <Mail className="size-4 text-muted-foreground" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{invite.email}</p>
            <p className="truncate text-xs text-muted-foreground">
              {invite.projectName
                ? t('joinsProject', { project: invite.projectName })
                : t('joinsTeam')}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3">
        <Badge variant="outline" className="font-normal">
          {tManage(`roles.${invite.teamRole}`)}
        </Badge>
      </TableCell>
      <TableCell className="px-3 py-3 text-sm text-muted-foreground">{t('pending')}</TableCell>
      <TableCell className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={copy}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? t('copied') : t('copyLink')}
          </Button>
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
      </TableCell>
    </TableRow>
  );
}
