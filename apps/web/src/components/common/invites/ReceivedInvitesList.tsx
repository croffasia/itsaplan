'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReceivedInvite } from '@/lib/api/endpoints/invites';
import { Button } from '@/components/ui/button';

export default function ReceivedInvitesList({ items }: { items: ReceivedInvite[] }) {
  const t = useTranslations('invite.received');

  return (
    <ul className="divide-y">
      {items.map((invite) => (
        <li
          key={invite.token}
          className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 break-words">
            <p className="font-medium">{invite.teamName}</p>
            {invite.projectName && (
              <p className="mt-1 text-sm text-muted-foreground">{invite.projectName}</p>
            )}
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link
              aria-label={`${t('review')}: ${invite.teamName}${invite.projectName ? ` / ${invite.projectName}` : ''}`}
              href={`/invite/${encodeURIComponent(invite.token)}`}
            >
              {t('review')}
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
