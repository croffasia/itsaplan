import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const HEAD = 'text-xs font-medium text-muted-foreground';

export function TeamAiAgentTable({
  canEditDefaults,
  children,
}: {
  canEditDefaults: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('teams.agents');
  const tCommon = useTranslations('common');

  return (
    <Table className="min-w-[1000px] table-fixed">
      <colgroup>
        <col className="w-[24%]" />
        <col className="w-[20%]" />
        <col className="w-[17%]" />
        <col className="w-[23%]" />
        <col className="w-[8%]" />
        <col className="w-[8%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>{t('agent')}</TableHead>
          <TableHead className={HEAD}>{t('projects')}</TableHead>
          <TableHead className={HEAD}>{t('columns.triggers')}</TableHead>
          <TableHead className={HEAD}>{t('columns.configuration')}</TableHead>
          <TableHead className={HEAD}>
            <Tooltip>
              <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-4">
                {t('projectDefaultsColumn')}
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {t(canEditDefaults ? 'projectDefaultsHint' : 'projectDefaultsReadOnly')}
              </TooltipContent>
            </Tooltip>
          </TableHead>
          <TableHead className={`text-end ${HEAD}`}>{tCommon('actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  );
}
