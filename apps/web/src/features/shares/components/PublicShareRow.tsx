import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type ShareKind, useRevokeShare } from '../services/shares.service';

export interface PublicShareRowData {
  id: number;
  label: string;
  href: string;
  // The link's switches that are on, as their labels.
  details: string[];
  expiresAt: string | null;
}

export default function PublicShareRow({
  projectKey,
  kind,
  icon: Icon,
  canRevoke,
  row,
}: {
  projectKey: string;
  kind: ShareKind;
  icon: LucideIcon;
  canRevoke: boolean;
  row: PublicShareRowData;
}) {
  const t = useTranslations('common.share');
  const format = useFormatter();
  const revoke = useRevokeShare(projectKey);

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <Link href={row.href} className="min-w-0 flex-1 truncate text-sm hover:underline" dir="auto">
        {row.label}
      </Link>
      {row.details.map((detail) => (
        <Badge
          key={detail}
          variant="secondary"
          className="hidden shrink-0 font-normal sm:inline-flex"
        >
          {detail}
        </Badge>
      ))}
      <span className="shrink-0 text-xs text-muted-foreground">
        {row.expiresAt
          ? t('expiresOn', {
              date: format.dateTime(new Date(row.expiresAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })
          : t('neverExpires')}
      </span>
      {canRevoke && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={revoke.isPending}
          onClick={() => revoke.mutate({ kind, id: row.id })}
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          {t('stopSharing')}
        </Button>
      )}
    </li>
  );
}
