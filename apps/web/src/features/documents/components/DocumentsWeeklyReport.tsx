'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api/core/client';
import { useSaveWeeklyReport, useWeeklyReport } from '@/services/weeklyReports.service';
import { documentPath } from '@/utils/paths';
import DocumentsWeeklyReportPreview from './DocumentsWeeklyReportPreview';

export default function DocumentsWeeklyReport({
  projectKey,
  canSave,
}: {
  projectKey: string;
  canSave: boolean;
}) {
  const t = useTranslations('documents.weeklyReport');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const query = useWeeklyReport(projectKey, open);
  const save = useSaveWeeklyReport(projectKey);
  const report = query.isFetching ? undefined : query.data;
  const goToReport = (id: number) => {
    setOpen(false);
    router.push(documentPath(projectKey, id));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t('title')}
          className="h-8 px-2.5 shadow-none"
        >
          <CalendarDays />
          <span className="hidden sm:inline">{t('title')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {report?.status === 'preview'
              ? t('weekOf', { date: report.weekStart })
              : t('previewHelp')}
          </DialogDescription>
        </DialogHeader>
        {query.isFetching && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('loading')}
          </p>
        )}
        {query.isError && (
          <div className="space-y-2 text-sm">
            <p role="alert">{t('loadFailed')}</p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              {t('retry')}
            </Button>
          </div>
        )}
        {!query.isError && report?.status === 'setup' && <p className="text-sm">{t('setup')}</p>}
        {!query.isError && report?.status === 'preview' && (
          <DocumentsWeeklyReportPreview report={report} />
        )}
        <DialogFooter>
          {!query.isError && report?.status === 'saved' && (
            <Button onClick={() => goToReport(report.documentId)}>{t('openSaved')}</Button>
          )}
          {!query.isError && report?.status === 'preview' && canSave && (
            <Button
              disabled={save.isPending}
              onClick={() =>
                save.mutate(report.token, {
                  onSuccess: ({ documentId }) => goToReport(documentId),
                  onError: (error) => {
                    if (error instanceof ApiError && error.status === 409) void query.refetch();
                  },
                })
              }
            >
              {t('saveSnapshot')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
