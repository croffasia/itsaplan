import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const HEAD = 'text-xs font-medium text-muted-foreground';

export default function DocumentsArchiveTable({ children }: { children: ReactNode }) {
  const t = useTranslations('documents');
  const tCommon = useTranslations('common');

  return (
    <Table className="min-w-[720px] table-fixed">
      <colgroup>
        <col className="w-[36%]" />
        <col className="w-[26%]" />
        <col className="w-[20%]" />
        <col className="w-[12%]" />
        <col className="w-[6%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>{t('archiveTable.page')}</TableHead>
          <TableHead className={HEAD}>{t('inspector.location')}</TableHead>
          <TableHead className={HEAD}>{t('archiveTable.archivedBy')}</TableHead>
          <TableHead className={HEAD}>{t('archiveTable.archived')}</TableHead>
          <TableHead className={`text-end ${HEAD}`}>{tCommon('actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  );
}
