'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, FileSpreadsheet, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useImportDraft } from './useImportDraft';
import { AgentChatImportPreview } from './AgentChatImportPreview';

// The review card an agent's ```issue-import fence draws. It reads the draft from
// its id — never from the message text — so what Confirm creates is exactly what
// the mapping resolved on the server. Nothing is created until the button is
// pressed; that is the whole point of the card.
export default function AgentChatImportCard({ importId }: { importId: string }) {
  const t = useTranslations('common.agentChat');
  const { draft, error, result, busy, confirm, discard } = useImportDraft(importId);

  if (error && !draft) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
        <XCircle className="size-4 shrink-0 text-destructive" />
        <span className="text-destructive">{error}</span>
      </div>
    );
  }
  if (!draft) {
    return <Skeleton className="my-2 h-[180px] w-full rounded-lg" />;
  }

  return (
    <div className="my-2 flex flex-col gap-3 rounded-lg border bg-background px-3 py-3">
      <div className="flex items-center gap-2 text-sm font-medium" dir="auto">
        <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{draft.filename}</span>
        <span className="ms-auto shrink-0 text-xs text-muted-foreground">
          {t('importRows', { count: draft.preview?.totalRows ?? 0 })}
        </span>
      </div>

      {result ? (
        <div className="flex flex-col gap-1 text-sm">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-600" />
            {t('importConfirmed', { count: result.imported.length })}
          </p>
          {result.imported.map((issue) => (
            <p key={issue.key} className="ps-6 text-muted-foreground" dir="auto">
              {issue.key} · {issue.title}
            </p>
          ))}
          {result.skipped.map((skip) => (
            <p key={skip.row} className="ps-6 text-xs text-muted-foreground" dir="auto">
              {t('importSkippedRow', { row: skip.row, reason: skip.reason })}
            </p>
          ))}
        </div>
      ) : (
        <>
          {draft.status === 'mapped' && draft.preview ? (
            <AgentChatImportPreview columns={draft.preview.columns} rows={draft.preview.rows} />
          ) : null}
          {draft.status === 'mapped' ? (
            <>
              <p className="text-xs text-muted-foreground">{t('importAdjustHint')}</p>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={busy} onClick={() => void confirm()}>
                  {t('confirmImport')}
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void discard()}>
                  {t('cancelImport')}
                </Button>
                {busy && (
                  <span className="text-xs text-muted-foreground">{t('importWorking')}</span>
                )}
              </div>
            </>
          ) : draft.status === 'canceled' ? (
            <p className="text-xs text-muted-foreground">{t('importCanceled')}</p>
          ) : draft.status === 'failed' ? (
            <p className="text-xs text-destructive" dir="auto">
              {draft.errorText ?? t('importFailed')}
            </p>
          ) : null}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
}
