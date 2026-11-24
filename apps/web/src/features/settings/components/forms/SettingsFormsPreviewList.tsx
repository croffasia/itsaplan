'use client';

import { Code, Link2, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const HEAD = 'text-xs font-medium text-muted-foreground';

const ACTIONS = { link: Link2, widget: Code, edit: Pencil, delete: Trash2 };

const ROWS = [
  { title: '45%', link: '4rem' },
  { title: '60%', link: '6rem' },
  { title: '35%', link: '5rem' },
];

export default function SettingsFormsPreviewList() {
  const t = useTranslations('sections.previews.forms');
  const tCommon = useTranslations('common');

  return (
    <Table className="min-w-[640px] table-fixed">
      <colgroup>
        <col className="w-[32%]" />
        <col className="w-[32%]" />
        <col className="w-[14%]" />
        <col className="w-[22%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>{t('columns.form')}</TableHead>
          <TableHead className={HEAD}>{t('columns.link')}</TableHead>
          <TableHead className={HEAD}>{t('enabled')}</TableHead>
          <TableHead className={`${HEAD} text-end`}>{tCommon('actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map(({ title, link }) => (
          <TableRow key={title}>
            <TableCell className="px-3 py-3">
              <Skeleton className="h-3.5" style={{ width: title }} />
            </TableCell>
            <TableCell className="px-3 py-3">
              <div dir="ltr" className="flex items-center gap-0.5 text-sm text-muted-foreground">
                /p/forms/
                <Skeleton className="h-3.5" style={{ width: link }} />
              </div>
            </TableCell>
            <TableCell className="px-3 py-3">
              <Skeleton className="h-5 w-9 rounded-full" />
            </TableCell>
            <TableCell className="px-3 py-2">
              <div className="flex justify-end gap-1">
                {Object.entries(ACTIONS).map(([action, Icon]) => (
                  <span
                    key={action}
                    className="flex size-8 items-center justify-center text-muted-foreground"
                  >
                    <Icon className="size-4" />
                  </span>
                ))}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
