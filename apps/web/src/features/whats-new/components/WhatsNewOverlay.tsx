'use client';

import { useTranslations } from 'next-intl';
import { DatabaseBackup } from 'lucide-react';
import type { WhatsNew } from '@/lib/api/endpoints/updates';
import TakeoverScreen, { type TakeoverSection } from '@/components/common/page/TakeoverScreen';
import { releaseSections } from './ReleaseSections';
import WhatsNewBackup from './WhatsNewBackup';
import WhatsNewMigrationReport from './WhatsNewMigrationReport';

// What the releases since the reader's last visit brought, then — for an
// administrator — the backup taken before this one's migrations and what those
// migrations changed.
export default function WhatsNewOverlay({
  data,
  onClose,
}: {
  data: WhatsNew;
  onClose: () => void;
}) {
  const t = useTranslations('whatsNew');
  const tUpdates = useTranslations('updates');

  const sections: TakeoverSection[] = releaseSections(data.releases, {
    empty: tUpdates('noNotes'),
  });
  if (data.backup) {
    sections.push({
      id: 'backup',
      title: t('backup.title'),
      icon: <DatabaseBackup className="size-4 text-muted-foreground" />,
      body: <WhatsNewBackup backup={data.backup} />,
    });
  }
  if (data.migration) {
    sections.push({
      id: 'report',
      title: t('report.title'),
      description: t('report.subtitle'),
      body: <WhatsNewMigrationReport report={data.migration} />,
    });
  }

  return (
    <TakeoverScreen
      eyebrow={t('eyebrow')}
      title={t('title', { version: data.version })}
      sections={sections}
      actionLabel={t('done')}
      onAction={onClose}
    />
  );
}
