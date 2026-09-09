'use client';

import { useTranslations } from 'next-intl';
import type { BackupInfo } from '@/lib/api/endpoints/updates';
import { formatDate } from '@/utils/dates';
import CodeBlock from '@/components/common/CodeBlock';

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Where the dump taken before this release's migrations is, and how to restore it.
// The file lives in the api container's volume, so the command copies it out first.
export default function WhatsNewBackup({ backup }: { backup: BackupInfo }) {
  const t = useTranslations('whatsNew');
  const restore = [
    `docker compose cp api:${backup.path} ./itsaplan-backup.dump`,
    'docker compose exec -T postgres pg_restore -U <user> -d <database> \\',
    '  --clean --if-exists < ./itsaplan-backup.dump',
  ].join('\n');

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('backup.body', {
            size: formatSize(backup.sizeBytes),
            expires: formatDate(backup.expiresAt),
          })}
        </p>
        <p className="rounded-md bg-muted/60 px-3 py-2 font-mono text-xs break-all" dir="ltr">
          {backup.path}
        </p>
      </div>

      <div className="min-w-0 space-y-3">
        <CodeBlock code={restore} />
        <p className="text-xs text-muted-foreground">{t('backup.credentialsHint')}</p>
      </div>
    </div>
  );
}
