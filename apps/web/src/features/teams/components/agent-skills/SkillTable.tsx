import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const HEAD = 'text-xs font-medium text-muted-foreground';

export function SkillTable({ children }: { children: ReactNode }) {
  const t = useTranslations('teams.skills');
  const tCommon = useTranslations('common');

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[820px] table-fixed">
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[58%]" />
          <col className="w-[14%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={HEAD}>{t('skill')}</TableHead>
            <TableHead className={HEAD}>{t('description')}</TableHead>
            <TableHead className={`text-end ${HEAD}`}>{tCommon('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}
